import type { Call, CallPrep, Lead, TranscriptTurn, VADRRun } from '@/types';
import { getTwilioClient } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { createTranscriptTurn } from '@/lib/transcript';
import { generateAgentReply } from '@/lib/agent';
import { callStore, type CallStore, type RunSession } from '@/server/store';
import { enrichCallData } from '@/lib/call-enrichment';

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
        // Normalize phone number to E.164 format (ensure it starts with +)
        let phoneNumber = call.lead.phone.trim();
        if (!phoneNumber.startsWith('+')) {
          // If it doesn't start with +, assume it's a US number and add +1
          phoneNumber = phoneNumber.replace(/^1/, ''); // Remove leading 1 if present
          phoneNumber = `+1${phoneNumber}`;
        }

        try {
          const answerUrl = `${baseUrl}/api/twilio/outbound?runId=${runId}&callId=${encodeURIComponent(call.id)}`;
          const statusCallback = `${baseUrl}/api/twilio/status?runId=${runId}&callId=${encodeURIComponent(call.id)}`;

          const result = await client.calls.create({
            to: phoneNumber,
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
            originalPhone: call.lead.phone,
            normalizedPhone: phoneNumber,
            twilioSid: result.sid,
            status: result.status,
          });

          await this.store.attachCallSid(call.id, result.sid);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorDetails = error && typeof error === 'object' && 'moreInfo' in error 
            ? (error as any).moreInfo 
            : null;
          
          console.error('[call-service] failed to start call', {
            runId,
            callId: call.id,
            originalPhone: call.lead.phone,
            normalizedPhone: phoneNumber,
            error: errorMessage,
            errorDetails,
            baseUrl,
            answerUrl: `${baseUrl}/api/twilio/outbound?runId=${runId}&callId=${encodeURIComponent(call.id)}`,
            twilioError: error,
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
    let shouldTerminate = false;
    let retryCount = 0;
    const maxRetries = 2;

    if (speechResult && speechResult.trim().length > 0) {
      const humanTurn = createTranscriptTurn(callId, 'human', speechResult.trim());
      await this.store.appendTranscript(callId, humanTurn);

      // Retry logic for agent reply generation
      while (retryCount <= maxRetries) {
        try {
          const conversation = await this.store.getConversationHistory(callId);
          console.log('[call-service] received speech', {
            runId,
            callId,
            speech: speechResult.trim(),
            attempt: retryCount + 1,
          });

          const agentReply = await generateAgentReply({
            conversation,
            prep: runSession.prep,
            lead: callSession.call.lead,
            lastUtterance: speechResult.trim(),
          });

          replyText = agentReply.text;
          shouldTerminate = agentReply.shouldTerminate;
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          console.error('[call-service] failed to generate agent reply', {
            runId,
            callId,
            error,
            attempt: retryCount,
            willRetry: retryCount <= maxRetries,
          });

          if (retryCount > maxRetries) {
            // All retries exhausted, use contextual fallback
            const turnCount = Math.floor(
              (await this.store.getConversationHistory(callId)).filter((m) => m.role !== 'system').length / 2
            );

            if (turnCount >= 5) {
              replyText = "I apologize, I'm having technical difficulties. Let me have someone follow up with you. Thank you for your time!";
              shouldTerminate = true;
            } else {
              replyText = DEFAULT_REPLY;
            }
          } else {
            // Wait before retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 500 * retryCount));
          }
        }
      }
    } else {
      // No speech received, check if we should terminate due to repeated failures
      const conversation = await this.store.getConversationHistory(callId);
      const recentAiTurns = conversation.filter((m) => m.role === 'assistant').slice(-3);

      const repeatedDefaults = recentAiTurns.filter((turn) => turn.content === DEFAULT_REPLY).length;

      if (repeatedDefaults >= 2) {
        replyText = "I'm having trouble hearing you. Let me have someone call you back. Thank you!";
        shouldTerminate = true;
        console.log('[call-service] terminating due to repeated speech failures', {
          runId,
          callId,
        });
      }
    }

    const aiTurn = createTranscriptTurn(callId, 'ai', replyText);
    await this.store.appendTranscript(callId, aiTurn);

    console.log('[call-service] responding with ai turn', {
      runId,
      callId,
      replyText,
      shouldTerminate,
    });

    return { replyText, shouldTerminate };
  }

  async getConversationHistory(callId: string) {
    return this.store.getConversationHistory(callId);
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
      
      // Enrich call data with Captain API after completion
      await this.enrichCompletedCall(callId);
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

    // Enrich call data with Captain API after completion
    await this.enrichCompletedCall(callId);
  }

  async recordAgentPrompt(callId: string, text: string) {
    const callSession = await this.store.getCall(callId);
    if (!callSession) {
      return;
    }

    const existingAiTurn = [...callSession.call.transcript]
      .reverse()
      .find((turn) => turn.speaker === 'ai');

    if (existingAiTurn?.text.trim() === text.trim()) {
      return;
    }

    const aiTurn = createTranscriptTurn(callId, 'ai', text);
    await this.store.appendTranscript(callId, aiTurn);
  }

  async getRun(runId: string) {
    return this.store.getRun(runId);
  }

  async getCall(callId: string) {
    return this.store.getCall(callId);
  }

  /**
   * Enrich a completed call with additional data from Captain API
   * This runs asynchronously and updates extractedData with missing fields
   */
  private async enrichCompletedCall(callId: string): Promise<void> {
    try {
      const callSession = await this.store.getCall(callId);
      if (!callSession) {
        console.warn('[call-service] Cannot enrich call - call session not found', { callId });
        return;
      }

      const call = callSession.call;
      
      // Enrich in background - don't block call completion
      setImmediate(async () => {
        try {
          const enriched = await enrichCallData(call);
          
          if (enriched) {
            // Update the call with enriched data
            await this.store.updateCallState(callId, call.state, {
              extractedData: enriched,
            });
            
            console.log('[call-service] Call enriched successfully', {
              callId,
              leadName: call.lead.name,
              enrichedFields: Object.keys(enriched).filter(k => enriched[k as keyof typeof enriched]),
            });
          }
        } catch (error) {
          // Log error but don't throw - enrichment failure shouldn't break call completion
          console.error('[call-service] Failed to enrich call', {
            callId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    } catch (error) {
      console.error('[call-service] Error setting up enrichment', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

