import type { Call, CallPrep, Lead, TranscriptTurn, VADRRun } from '@/types';
import { getTwilioClient } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { createTranscriptTurn } from '@/lib/transcript';
import { generateAgentReply } from '@/lib/agent';
import { callStore, type CallStore, type RunSession } from '@/server/store';

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

class CallService {
  constructor(private readonly store: CallStore) {}

  async startRun(args: StartRunArgs): Promise<{ run: VADRRun; session: RunSession }> {
    const { runId, query, leads, prep } = args;
    const createdBy = args.createdBy ?? 'vadr-user';

    const session = await this.store.createRun({ runId, query, createdBy, prep, leads });
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
      calls: session.run.calls.map((call) => ({
        callId: call.id,
        leadId: call.leadId,
        to: call.lead.phone,
      })),
    });

    await Promise.all(
      session.run.calls.map(async (call) => {
        try {
          const answerUrl = `${baseUrl}/api/twilio/outbound?runId=${runId}&callId=${encodeURIComponent(call.id)}`;
          const statusCallback = `${baseUrl}/api/twilio/status?runId=${runId}&callId=${encodeURIComponent(call.id)}`;

          const result = await client.calls.create({
            to: call.lead.phone,
            from: fromNumber,
            url: answerUrl,
            statusCallback,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            record: false,
          });

          console.log('[call-service] call created', {
            runId,
            callId: call.id,
            to: call.lead.phone,
            twilioSid: result.sid,
            status: result.status,
          });

          await this.store.attachCallSid(call.id, result.sid);
        } catch (error) {
          console.error('[call-service] failed to start call', {
            runId,
            callId: call.id,
            to: call.lead.phone,
            error,
          });
          await this.store.updateCallState(call.id, 'failed');
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
    }

    let replyText = DEFAULT_REPLY;

    if (speechResult && speechResult.trim().length > 0) {
      const humanTurn = createTranscriptTurn(callId, 'human', speechResult.trim());
      await this.store.appendTranscript(callId, humanTurn);

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
  }

  async setListening(callId: string, isListening: boolean) {
    await this.store.setListening(callId, isListening);
  }

  async setTakeOver(callId: string, isTakenOver: boolean) {
    await this.store.setTakeOver(callId, isTakenOver);
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
  }

  async getRun(runId: string) {
    return this.store.getRun(runId);
  }

  async getCall(callId: string) {
    return this.store.getCall(callId);
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

