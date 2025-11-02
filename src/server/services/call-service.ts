import type { Call, CallPrep, Lead, VADRRun } from '@/types';
import { getTwilioClient } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { createTranscriptTurn } from '@/lib/transcript';
import { generateAgentReply } from '@/lib/agent';
import {
  callStore,
  type CallEvent,
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

class CallService {
  constructor(private readonly store: CallStore) {}

  async startRun(args: StartRunArgs): Promise<{ run: VADRRun; session: RunSession }> {
    const { runId, query, leads, prep } = args;
    const createdBy = args.createdBy ?? 'vadr-user';

    const session = this.store.createRun({ runId, query, createdBy, prep, leads });

    const client = getTwilioClient();
    const fromNumber = env.twilioPhoneNumber();
    if (!fromNumber) {
      throw new Error('Twilio caller ID not configured');
    }

    const baseUrl = resolvePublicBaseUrl();

    const callSessions = session.callIds
      .map((callId) => this.store.getCall(callId))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

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
            statusCallbackEvent: ['queued', 'initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer'],
            machineDetection: 'DetectMessageEnd',
            record: false,
          });

          this.store.attachCallSid(callSession.call.id, result.sid);
        } catch (error) {
          console.error('Failed to start call', error);
          this.store.updateCallState(callSession.call.id, 'failed');
        }
      })
    );

    return { run: session.run, session };
  }

  async handleGather({ runId, callId, speechResult, callSid }: GatherArgs) {
    if (callSid) {
      const callSession = this.store.findCallBySid(callSid);
      if (callSession && callSession.call.id !== callId) {
        this.store.attachCallSid(callId, callSid);
      }
    }

    const callSession = this.store.getCall(callId);
    const runSession = this.store.getRun(runId);

    if (!callSession || !runSession) {
      throw new Error('Unknown call session');
    }

    if (callSession.call.state !== 'connected') {
      this.store.updateCallState(callId, 'connected');
    }

    let replyText = DEFAULT_REPLY;

    if (speechResult && speechResult.trim().length > 0) {
      const humanTurn = createTranscriptTurn(callId, 'human', speechResult.trim());
      this.store.appendTranscript(callId, humanTurn);

      try {
        const conversation = this.store.getConversationHistory(callId);
        replyText = await generateAgentReply({
          conversation,
          prep: runSession.prep,
          lead: callSession.call.lead,
          lastUtterance: speechResult.trim(),
        });
      } catch (error) {
        console.error('Failed to generate agent reply', error);
        replyText = DEFAULT_REPLY;
      }
    }

    const aiTurn = createTranscriptTurn(callId, 'ai', replyText);
    this.store.appendTranscript(callId, aiTurn);

    return { replyText };
  }

  async handleStatus({ runId, callId, callStatus, answeredBy, callSid, callDuration }: StatusArgs) {
    if (callSid) {
      this.store.attachCallSid(callId, callSid);
    }

    const callSession = this.store.getCall(callId);
    if (!callSession) {
      throw new Error('Unknown call session');
    }

    const { state } = this.mapStatus(callStatus, answeredBy);

    if (state === 'completed') {
      const durationSeconds = Number.parseInt(callDuration ?? '0', 10);
      this.store.updateCallState(callId, state, { duration: Number.isFinite(durationSeconds) ? durationSeconds : 0 });
    } else {
      this.store.updateCallState(callId, state);
    }
  }

  async setListening(callId: string, isListening: boolean) {
    this.store.setListening(callId, isListening);
  }

  async setTakeOver(callId: string, isTakenOver: boolean) {
    this.store.setTakeOver(callId, isTakenOver);
  }

  async endCall(callId: string) {
    const callSession = this.store.getCall(callId);
    if (!callSession) return;

    const twilioSid = callSession.twilioCallSid;
    if (twilioSid) {
      try {
        await getTwilioClient().calls(twilioSid).update({ status: 'completed' });
      } catch (error) {
        console.error('Failed to end call via Twilio', error);
      }
    }

    this.store.updateCallState(callId, 'completed');
  }

  subscribe(runId: string, listener: (event: CallEvent) => void) {
    this.store.subscribe(runId, listener);
  }

  unsubscribe(runId: string, listener: (event: CallEvent) => void) {
    this.store.unsubscribe(runId, listener);
  }

  getRun(runId: string) {
    return this.store.getRun(runId);
  }

  getCall(callId: string) {
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
export type { CallEvent };

