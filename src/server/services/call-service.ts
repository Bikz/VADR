import type { Prisma, PrismaClient } from '@prisma/client';
import type { Call, CallPrep, Lead, TranscriptTurn, VADRRun } from '@/types';
import { prisma } from '@/lib/db';
import { getTwilioClient } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { createTranscriptTurn } from '@/lib/transcript';
import { generateAgentReply } from '@/lib/agent';
import {
  callStore,
  type CallSession,
  type CallStore,
  type RunSession
} from '@/server/store';

interface StartRunArgs {
  runId: string;
  query: string;
  leads: Lead[];
  prep: CallPrep;
  createdBy?: string;
}

interface GatherArgs {
  runId: string;
  callId: string;
  speechResult?: string;
  callSid?: string;
}

interface StatusArgs {
  runId: string;
  callId: string;
  callStatus: string;
  answeredBy?: string;
  callSid?: string;
  callDuration?: string;
}

const DEFAULT_REPLY = 'Thanks for sharing. Could you tell me more?';

type PrismaExecutor = Prisma.TransactionClient | PrismaClient;

class CallService {
  constructor(private readonly store: CallStore) {}

  async startRun(args: StartRunArgs): Promise<{ run: VADRRun; session: RunSession }> {
    const { runId, query, leads, prep } = args;
    const createdBy = args.createdBy ?? 'vadr-user';

    const session = await this.store.createRun({ runId, query, createdBy, prep, leads });
    const callSessions = await this.fetchCallSessions(session.callIds);

    await this.persistRunSession(session, callSessions);

    const client = getTwilioClient();
    const fromNumber = env.twilioPhoneNumber();
    if (!fromNumber) {
      throw new Error('Twilio caller ID not configured');
    }

    const baseUrl = resolvePublicBaseUrl();

    console.log('[call-service] creating outbound calls', {
      runId,
      fromNumber,
      baseUrl,
      calls: callSessions.map((callSession) => ({
        callId: callSession.call.id,
        leadId: callSession.call.leadId,
        to: callSession.call.lead.phone,
      })),
    });

    await Promise.all(
      callSessions.map(async (callSession) => {
        try {
          const answerUrl = `${baseUrl}/api/twilio/outbound?runId=${runId}&callId=${encodeURIComponent(callSession.call.id)}`;
          const statusCallback = `${baseUrl}/api/twilio/status?runId=${runId}&callId=${encodeURIComponent(callSession.call.id)}`;

          const result = await client.calls.create({
            to: callSession.call.lead.phone,
            from: fromNumber,
            url: answerUrl,
            statusCallback,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            record: false,
          });

          console.log('[call-service] call created', {
            runId,
            callId: callSession.call.id,
            to: callSession.call.lead.phone,
            twilioSid: result.sid,
            status: result.status,
          });

          await this.store.attachCallSid(callSession.call.id, result.sid);
        } catch (error) {
          console.error('[call-service] failed to start call', {
            runId,
            callId: callSession.call.id,
            to: callSession.call.lead.phone,
            error,
          });
          await this.store.updateCallState(callSession.call.id, 'failed');
          const updated = await this.store.getCall(callSession.call.id);
          if (updated) {
            await this.persistCallSession(updated);
          }
        }
      })
    );

    return { run: session.run, session };
  }

  async handleGather({ runId, callId, speechResult, callSid }: GatherArgs) {
    if (callSid) {
      const callSession = await this.store.findCallBySid(callSid);
      if (callSession && callSession.call.id !== callId) {
        await this.store.attachCallSid(callId, callSid);
      }
    }

    const callSession = await this.store.getCall(callId);
    const runSession = await this.store.getRun(runId);

    if (!callSession || !runSession) {
      throw new Error('Unknown call session');
    }

    if (callSession.call.state !== 'connected') {
      await this.store.updateCallState(callId, 'connected');
      const updated = await this.store.getCall(callId);
      if (updated) {
        await this.persistCallSession(updated);
      }
    }

    let replyText = DEFAULT_REPLY;

    if (speechResult && speechResult.trim().length > 0) {
      const humanTurn = createTranscriptTurn(callId, 'human', speechResult.trim());
      await this.store.appendTranscript(callId, humanTurn);
      await this.persistTranscriptTurn(runId, callId, humanTurn);
      const updatedAfterHuman = await this.store.getCall(callId);
      if (updatedAfterHuman) {
        await this.persistCallSession(updatedAfterHuman);
      }

      try {
        const conversation = await this.store.getConversationHistory(callId);
        console.log('[call-service] received speech', {
          runId,
          callId,
          speech: speechResult.trim(),
        });
        replyText = await generateAgentReply({
          conversation,
          prep: runSession.prep,
          lead: callSession.call.lead,
          lastUtterance: speechResult.trim(),
        });
      } catch (error) {
        console.error('[call-service] failed to generate agent reply', {
          runId,
          callId,
          error,
        });
        replyText = DEFAULT_REPLY;
      }
    }

    const aiTurn = createTranscriptTurn(callId, 'ai', replyText);
    await this.store.appendTranscript(callId, aiTurn);
    await this.persistTranscriptTurn(runId, callId, aiTurn);
    const updatedAfterAi = await this.store.getCall(callId);
    if (updatedAfterAi) {
      await this.persistCallSession(updatedAfterAi);
    }

    console.log('[call-service] responding with ai turn', {
      runId,
      callId,
      replyText,
    });

    return { replyText };
  }

  async handleStatus({ runId, callId, callStatus, answeredBy, callSid, callDuration }: StatusArgs) {
    if (callSid) {
      await this.store.attachCallSid(callId, callSid);
    }

    const callSession = await this.store.getCall(callId);
    if (!callSession) {
      throw new Error('Unknown call session');
    }

    const { state } = this.mapStatus(callStatus, answeredBy);

    console.log('[call-service] status callback', {
      runId,
      callId,
      callSid,
      callStatus,
      answeredBy,
      mappedState: state,
      callDuration,
    });

    if (state === 'completed') {
      const durationSeconds = Number.parseInt(callDuration ?? '0', 10);
      await this.store.updateCallState(callId, state, { duration: Number.isFinite(durationSeconds) ? durationSeconds : 0 });
    } else {
      await this.store.updateCallState(callId, state);
    }

    const updated = await this.store.getCall(callId);
    if (updated) {
      await this.persistCallSession(updated);
    }
  }

  async setListening(callId: string, isListening: boolean) {
    await this.store.setListening(callId, isListening);
    const updated = await this.store.getCall(callId);
    if (updated) {
      await this.persistCallSession(updated);
    }
  }

  async setTakeOver(callId: string, isTakenOver: boolean) {
    await this.store.setTakeOver(callId, isTakenOver);
    const updated = await this.store.getCall(callId);
    if (updated) {
      await this.persistCallSession(updated);
    }
  }

  async endCall(callId: string) {
    const callSession = await this.store.getCall(callId);
    if (!callSession) return;

    const twilioSid = callSession.twilioCallSid;
    if (twilioSid) {
      try {
        await getTwilioClient().calls(twilioSid).update({ status: 'completed' });
        console.log('[call-service] ended call via Twilio', { callId, twilioSid });
      } catch (error) {
        console.error('[call-service] failed to end call via Twilio', {
          callId,
          twilioSid,
          error,
        });
      }
    }

    await this.store.updateCallState(callId, 'completed');
    const updated = await this.store.getCall(callId);
    if (updated) {
      await this.persistCallSession(updated);
    }
  }

  async getRun(runId: string) {
    return this.store.getRun(runId);
  }

  async getCall(callId: string) {
    return this.store.getCall(callId);
  }

  private async fetchCallSessions(callIds: string[]): Promise<CallSession[]> {
    const sessions = await Promise.all(callIds.map((callId) => this.store.getCall(callId)));
    return sessions.filter((value): value is CallSession => Boolean(value));
  }

  private toDate(value?: number) {
    return typeof value === 'number' ? new Date(value) : null;
  }

  private async persistRunSession(session: RunSession, callSessions: CallSession[]) {
    if (!prisma) return;

    await prisma.$transaction(async (tx) => {
      const prepJson = session.prep as unknown as Prisma.InputJsonValue;

      await tx.run.upsert({
        where: { id: session.run.id },
        create: {
          id: session.run.id,
          query: session.run.query,
          createdBy: session.run.createdBy,
          status: session.run.status,
          startedAt: new Date(session.run.startedAt),
          prep: prepJson,
        },
        update: {
          query: session.run.query,
          status: session.run.status,
          startedAt: new Date(session.run.startedAt),
          prep: prepJson,
        },
      });

      for (const callSession of callSessions) {
        await this.upsertCall(tx, callSession);
      }
    });
  }

  private async persistCallSession(callSession: CallSession) {
    if (!prisma) return;
    await this.upsertCall(prisma, callSession);
  }

  private async persistTranscriptTurn(runId: string, callId: string, turn: TranscriptTurn) {
    if (!prisma) return;

    try {
      await prisma.transcriptTurn.upsert({
        where: { id: turn.id },
        create: {
          id: turn.id,
          callId,
          speaker: turn.speaker,
          text: turn.text,
          timestamp: new Date(turn.timestamp),
          t0Ms: turn.t0_ms ?? null,
          t1Ms: turn.t1_ms ?? null,
        },
        update: {
          text: turn.text,
          t0Ms: turn.t0_ms ?? null,
          t1Ms: turn.t1_ms ?? null,
        },
      });

      await prisma.call.update({
        where: { id: callId },
        data: {
          updatedAt: new Date(),
        },
      }).catch(() => {});
    } catch (error) {
      console.error('[call-service] failed to persist transcript turn', {
        runId,
        callId,
        turnId: turn.id,
        error,
      });
    }
  }

  private async upsertCall(executor: PrismaExecutor, callSession: CallSession) {

    const { call } = callSession;
    const lead = call.lead;

    await executor.call.upsert({
      where: { id: call.id },
      create: {
        id: call.id,
        runId: callSession.runId,
        leadId: lead.id,
        leadName: lead.name,
        leadPhone: lead.phone,
        leadSource: lead.source,
        leadRating: lead.rating,
        leadReviewCount: lead.reviewCount,
        leadDescription: lead.description,
        leadConfidence: lead.confidence,
        leadUrl: lead.url,
        state: call.state,
        sentiment: call.sentiment,
        startedAt: this.toDate(call.startedAt) ?? undefined,
        endedAt: this.toDate(call.endedAt) ?? undefined,
        durationSeconds: call.duration ?? null,
      },
      update: {
        state: call.state,
        sentiment: call.sentiment,
        startedAt: this.toDate(call.startedAt) ?? undefined,
        endedAt: this.toDate(call.endedAt) ?? undefined,
        durationSeconds: call.duration ?? null,
        leadName: lead.name,
        leadPhone: lead.phone,
        leadSource: lead.source,
        leadRating: lead.rating,
        leadReviewCount: lead.reviewCount,
        leadDescription: lead.description,
        leadConfidence: lead.confidence,
        leadUrl: lead.url,
      },
    });
  }

  private mapStatus(callStatus: string, answeredBy?: string): { state: Call['state'] } {
    const normalized = callStatus?.toLowerCase();

    if (answeredBy && answeredBy.toLowerCase().startsWith('machine')) {
      return { state: 'voicemail' };
    }

    switch (normalized) {
      case 'queued':
      case 'initiated':
        return { state: 'dialing' };
      case 'ringing':
        return { state: 'ringing' };
      case 'in-progress':
      case 'answered':
        return { state: 'connected' };
      case 'completed':
        return { state: 'completed' };
      case 'failed':
      case 'busy':
      case 'no-answer':
      case 'canceled':
        return { state: 'failed' };
      default:
        return { state: 'dialing' };
    }
  }
}

export const callService = new CallService(callStore);
