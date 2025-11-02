import type { Call, CallState, TranscriptTurn } from '@vadr/shared';
import type { CallSession, CallStore, CreateRunParams, RunSession } from './types';

const TERMINAL_STATES: CallState[] = ['completed', 'failed', 'voicemail'];

export class InMemoryCallStore implements CallStore {
  private runs = new Map<string, RunSession>();
  private calls = new Map<string, CallSession>();
  private callSidToId = new Map<string, string>();

  async createRun(params: CreateRunParams): Promise<RunSession> {
    const { runId, query, createdBy, prep, leads } = params;

    const existing = this.runs.get(runId);
    if (existing) {
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

    this.runs.set(runId, session);

    callEntries.forEach((call) => {
      this.calls.set(call.id, {
        runId,
        call,
        conversation: [
          {
            role: 'system',
            content: `You are VADR, an AI assistant calling businesses to accomplish the objective: ${prep.objective}. Follow the script flow and stay polite. Avoid disallowed topics: ${prep.disallowedTopics.join(', ')}.`,
          },
        ],
      });
    });

    this.recalculateRunStatus(runId);
    return session;
  }

  async attachCallSid(callId: string, callSid: string): Promise<void> {
    const session = this.calls.get(callId);
    if (!session) return;

    session.twilioCallSid = callSid;
    this.callSidToId.set(callSid, callId);
    this.recalculateRunStatus(session.runId);
  }

  async findCallBySid(callSid: string): Promise<CallSession | undefined> {
    const callId = this.callSidToId.get(callSid);
    if (!callId) return undefined;
    return this.calls.get(callId);
  }

  async updateCallState(callId: string, state: CallState, extra: Partial<Call> = {}): Promise<void> {
    const session = this.calls.get(callId);
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

    session.call = {
      ...call,
      ...extra,
      state,
    };

    this.calls.set(callId, session);
    this.recalculateRunStatus(session.runId);
  }

  async appendTranscript(callId: string, turn: TranscriptTurn, sentiment?: Call['sentiment']): Promise<void> {
    const session = this.calls.get(callId);
    if (!session) return;

    session.call.transcript = [...session.call.transcript, turn];
    if (sentiment) {
      session.call.sentiment = sentiment;
    }

    session.conversation.push({
      role: turn.speaker === 'ai' ? 'assistant' : 'user',
      content: turn.text,
    });

    this.recalculateRunStatus(session.runId);
  }

  async getRun(runId: string): Promise<RunSession | undefined> {
    return this.runs.get(runId);
  }

  async getCall(callId: string): Promise<CallSession | undefined> {
    return this.calls.get(callId);
  }

  async getConversationHistory(callId: string) {
    return this.calls.get(callId)?.conversation ?? [];
  }

  async getPrepForRun(runId: string) {
    return this.runs.get(runId)?.prep;
  }

  async setListening(callId: string, isListening: boolean): Promise<void> {
    const session = this.calls.get(callId);
    if (!session) return;

    session.call.isListening = isListening;
    this.recalculateRunStatus(session.runId);
  }

  async setTakeOver(callId: string, isTakenOver: boolean): Promise<void> {
    const session = this.calls.get(callId);
    if (!session) return;

    session.call.isTakenOver = isTakenOver;
    this.recalculateRunStatus(session.runId);
  }

  private recalculateRunStatus(runId: string) {
    const runSession = this.runs.get(runId);
    if (!runSession) return;

    const callSessions = runSession.callIds
      .map((callId) => this.calls.get(callId)?.call)
      .filter((call): call is Call => Boolean(call));

    if (callSessions.length === 0) return;

    runSession.run.calls = callSessions.map((call) => ({ ...call }));

    const allTerminal = callSessions.every((call) => TERMINAL_STATES.includes(call.state));
    const nextStatus = allTerminal ? 'completed' : 'calling';

    runSession.run.status = nextStatus;
  }
}
