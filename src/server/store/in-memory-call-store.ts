import type { Call, CallState, TranscriptTurn } from '@/types';
import type {
  CallEvent,
  CallSession,
  CallStore,
  CreateRunParams,
  RunSession
} from './types';

const TERMINAL_STATES: CallState[] = ['completed', 'failed', 'voicemail'];

export class InMemoryCallStore implements CallStore {
  private runs = new Map<string, RunSession>();
  private calls = new Map<string, CallSession>();
  private callSidToId = new Map<string, string>();
  private listeners = new Map<string, Set<(event: CallEvent) => void>>();

  createRun(params: CreateRunParams): RunSession {
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

    this.publishRun(runId);

    return session;
  }

  attachCallSid(callId: string, callSid: string) {
    const session = this.calls.get(callId);
    if (!session) return;

    session.twilioCallSid = callSid;
    this.callSidToId.set(callSid, callId);
  }

  findCallBySid(callSid: string): CallSession | undefined {
    const callId = this.callSidToId.get(callSid);
    if (!callId) return undefined;
    return this.calls.get(callId);
  }

  updateCallState(callId: string, state: CallState, extra: Partial<Call> = {}) {
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
    this.publishCall(callId);
    this.recalculateRunStatus(session.runId);
  }

  appendTranscript(callId: string, turn: TranscriptTurn, sentiment?: Call['sentiment']) {
    const session = this.calls.get(callId);
    if (!session) return;

    session.call.transcript = [...session.call.transcript, turn];
    if (sentiment) {
      session.call.sentiment = sentiment;
    }

    if (turn.speaker === 'ai') {
      session.conversation.push({ role: 'assistant', content: turn.text });
    } else {
      session.conversation.push({ role: 'user', content: turn.text });
    }

    this.publish(session.runId, {
      type: 'call:transcript',
      runId: session.runId,
      callId,
      turn,
    });

    this.publishCall(callId);
  }

  getRun(runId: string): RunSession | undefined {
    return this.runs.get(runId);
  }

  getCall(callId: string): CallSession | undefined {
    return this.calls.get(callId);
  }

  getConversationHistory(callId: string) {
    return this.calls.get(callId)?.conversation ?? [];
  }

  getPrepForRun(runId: string) {
    return this.runs.get(runId)?.prep;
  }

  setListening(callId: string, isListening: boolean) {
    const session = this.calls.get(callId);
    if (!session) return;

    session.call.isListening = isListening;
    this.publishCall(callId);
  }

  setTakeOver(callId: string, isTakenOver: boolean) {
    const session = this.calls.get(callId);
    if (!session) return;

    session.call.isTakenOver = isTakenOver;
    this.publishCall(callId);
  }

  subscribe(runId: string, listener: (event: CallEvent) => void) {
    let listeners = this.listeners.get(runId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(runId, listeners);
    }

    listeners.add(listener);

    const run = this.runs.get(runId);
    if (run) {
      listener({ type: 'run:update', run: run.run });
      run.callIds.forEach((callId) => {
        const session = this.calls.get(callId);
        if (session) {
          listener({ type: 'call:update', runId, call: session.call });
        }
      });
    }
  }

  unsubscribe(runId: string, listener: (event: CallEvent) => void) {
    const listeners = this.listeners.get(runId);
    if (!listeners) return;

    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(runId);
    }
  }

  private publish(runId: string, event: CallEvent) {
    const listeners = this.listeners.get(runId);
    if (!listeners) return;

    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Failed to publish call event', error);
      }
    });
  }

  private publishRun(runId: string) {
    const runSession = this.runs.get(runId);
    if (!runSession) return;
    this.publish(runId, { type: 'run:update', run: runSession.run });
  }

  private publishCall(callId: string) {
    const session = this.calls.get(callId);
    if (!session) return;

    this.publish(session.runId, {
      type: 'call:update',
      runId: session.runId,
      call: session.call,
    });
  }

  private recalculateRunStatus(runId: string) {
    const runSession = this.runs.get(runId);
    if (!runSession) return;

    const callSessions = runSession.callIds
      .map((callId) => this.calls.get(callId)?.call)
      .filter((call): call is Call => Boolean(call));

    if (callSessions.length === 0) return;

    const allTerminal = callSessions.every((call) => TERMINAL_STATES.includes(call.state));
    const nextStatus = allTerminal ? 'completed' : 'calling';

    if (runSession.run.status !== nextStatus) {
      runSession.run.status = nextStatus;
      runSession.run.calls = callSessions;
      this.publishRun(runId);
    }
  }
}

