import { Redis } from '@upstash/redis';
import type { Call, CallState, TranscriptTurn } from '@/types';
import type { CallSession, CallStore, CreateRunParams, RunSession } from './types';

const DAY_IN_SECONDS = 60 * 60 * 24;
const TERMINAL_STATES: CallState[] = ['completed', 'failed', 'voicemail'];

export class RedisCallStore implements CallStore {
  constructor(private readonly redis: Redis, private readonly ttlSeconds = DAY_IN_SECONDS) {}

  private runKey(runId: string) {
    return `run:${runId}`;
  }

  private callKey(callId: string) {
    return `call:${callId}`;
  }

  private callIndexKey(runId: string) {
    return `run:${runId}:calls`;
  }

  private callSidKey(callSid: string) {
    return `callsid:${callSid}`;
  }

  private async refreshKeys(keys: string[]) {
    await Promise.all(keys.map(key => this.redis.expire(key, this.ttlSeconds)));
  }

  private buildConversationPrompt(prepObjective: string, disallowedTopics: string[]) {
    return `You are VADR, an AI assistant calling businesses to accomplish the objective: ${prepObjective}. Follow the script flow and stay polite. Avoid disallowed topics: ${disallowedTopics.join(', ')}.`;
  }

  async createRun(params: CreateRunParams): Promise<RunSession> {
    const { runId, query, createdBy, prep, leads } = params;
    const existing = await this.redis.get<RunSession>(this.runKey(runId));
    if (existing) {
      await this.refreshKeys([this.runKey(runId), this.callIndexKey(runId)]);
      return existing;
    }

    const timestamp = Date.now();
    const callEntries = leads.map<Call>((lead, index) => ({
      id: `call-${lead.id}-${timestamp}-${index}`,
      leadId: lead.id,
      lead,
      state: 'dialing',
      duration: 0,
      transcript: [],
      sentiment: 'neutral',
      isListening: false,
      isTakenOver: false,
    }));

    const run: RunSession['run'] = {
      id: runId,
      query,
      createdBy,
      startedAt: timestamp,
      status: 'calling',
      calls: callEntries,
    };

    const session: RunSession = {
      run,
      prep,
      leadMap: Object.fromEntries(leads.map((lead) => [lead.id, lead])),
      callIds: callEntries.map((call) => call.id),
    };

    await this.redis.set(this.runKey(runId), session, { ex: this.ttlSeconds });
    if (session.callIds.length) {
      const [first, ...rest] = session.callIds;
      await this.redis.sadd(this.callIndexKey(runId), first, ...rest);
      await this.redis.expire(this.callIndexKey(runId), this.ttlSeconds);
    }

    const baseConversation = this.buildConversationPrompt(prep.objective, prep.disallowedTopics);

    await Promise.all(
      callEntries.map((call) => {
        const callSession: CallSession = {
          runId,
          call,
          conversation: [
            {
              role: 'system',
              content: baseConversation,
            },
          ],
        };
        return this.redis.set(this.callKey(call.id), callSession, { ex: this.ttlSeconds });
      })
    );

    return session;
  }

  async attachCallSid(callId: string, callSid: string): Promise<void> {
    const session = await this.redis.get<CallSession>(this.callKey(callId));
    if (!session) return;

    session.twilioCallSid = callSid;
    await Promise.all([
      this.redis.set(this.callKey(callId), session, { ex: this.ttlSeconds }),
      this.redis.set(this.callSidKey(callSid), callId, { ex: this.ttlSeconds }),
    ]);
  }

  async findCallBySid(callSid: string): Promise<CallSession | undefined> {
    const callId = await this.redis.get<string>(this.callSidKey(callSid));
    if (!callId) return undefined;
    const stored = await this.redis.get<CallSession>(this.callKey(callId));
    return stored ?? undefined;
  }

  async updateCallState(callId: string, state: CallState, extra: Partial<Call> = {}): Promise<void> {
    const callKey = this.callKey(callId);
    const session = await this.redis.get<CallSession>(callKey);
    if (!session) return;

    const call = session.call;

    if (state === 'connected' && !call.startedAt) {
      call.startedAt = Date.now();
    }

    if (TERMINAL_STATES.includes(state)) {
      call.endedAt = Date.now();
      if (call.startedAt) {
        call.duration = Math.round((call.endedAt - call.startedAt) / 1000);
      }
    }

    session.call = { ...call, ...extra, state };
    await this.redis.set(callKey, session, { ex: this.ttlSeconds });
    if (session.twilioCallSid) {
      await this.redis.expire(this.callSidKey(session.twilioCallSid), this.ttlSeconds);
    }

    const run = await this.redis.get<RunSession>(this.runKey(session.runId));
    if (run) {
      run.run.calls = await this.getCallsForRun(run);
      if (run.run.calls.every((entry: Call) => TERMINAL_STATES.includes(entry.state))) {
        run.run.status = 'completed';
      } else if (session.call.state === 'connected') {
        run.run.status = 'calling';
      }
      await this.redis.set(this.runKey(session.runId), run, { ex: this.ttlSeconds });
    }
  }

  private async getCallsForRun(session: RunSession) {
    const entries = await Promise.all(
      session.callIds.map(async (callId) => {
        const stored = await this.redis.get<CallSession>(this.callKey(callId));
        return stored?.call;
      })
    );
    return entries.filter((value): value is Call => Boolean(value));
  }

  async appendTranscript(callId: string, turn: TranscriptTurn, sentiment?: Call['sentiment']): Promise<void> {
    const callKey = this.callKey(callId);
    const session = await this.redis.get<CallSession>(callKey);
    if (!session) return;

    session.call.transcript = [...session.call.transcript, turn];
    if (sentiment) {
      session.call.sentiment = sentiment;
    }

    session.conversation.push({
      role: turn.speaker === 'ai' ? 'assistant' : 'user',
      content: turn.text,
    });

    await this.redis.set(callKey, session, { ex: this.ttlSeconds });

    const run = await this.redis.get<RunSession>(this.runKey(session.runId));
    if (run) {
      run.run.calls = await this.getCallsForRun(run);
      await this.redis.set(this.runKey(session.runId), run, { ex: this.ttlSeconds });
    }
  }

  async getRun(runId: string): Promise<RunSession | undefined> {
    const stored = await this.redis.get<RunSession>(this.runKey(runId));
    if (!stored) return undefined;

    stored.run.calls = await this.getCallsForRun(stored);
    await this.refreshKeys([this.runKey(runId)]);
    return stored;
  }

  async getCall(callId: string): Promise<CallSession | undefined> {
    const session = await this.redis.get<CallSession>(this.callKey(callId));
    if (session) {
      await this.redis.expire(this.callKey(callId), this.ttlSeconds);
    }
    return session ?? undefined;
  }

  async getConversationHistory(callId: string) {
    const session = await this.redis.get<CallSession>(this.callKey(callId));
    return session?.conversation ?? [];
  }

  async getPrepForRun(runId: string) {
    const run = await this.redis.get<RunSession>(this.runKey(runId));
    return run?.prep;
  }

  async setListening(callId: string, isListening: boolean): Promise<void> {
    const callKey = this.callKey(callId);
    const session = await this.redis.get<CallSession>(callKey);
    if (!session) return;

    session.call.isListening = isListening;
    await this.redis.set(callKey, session, { ex: this.ttlSeconds });
  }

  async setTakeOver(callId: string, isTakenOver: boolean): Promise<void> {
    const callKey = this.callKey(callId);
    const session = await this.redis.get<CallSession>(callKey);
    if (!session) return;

    session.call.isTakenOver = isTakenOver;
    await this.redis.set(callKey, session, { ex: this.ttlSeconds });
  }
}
