import type { Call, CallPrep, CallState, Lead, TranscriptTurn, VADRRun } from '@/types';

export type CallEvent =
  | { type: 'call:update'; runId: string; call: Call }
  | { type: 'run:update'; run: VADRRun }
  | { type: 'call:transcript'; runId: string; callId: string; turn: TranscriptTurn };

export interface RunSession {
  run: VADRRun;
  prep: CallPrep;
  leadMap: Record<string, Lead>;
  callIds: string[];
}

export interface CallSession {
  runId: string;
  call: Call;
  conversation: Array<{ role: 'system' | 'assistant' | 'user'; content: string }>;
  twilioCallSid?: string;
}

export interface CreateRunParams {
  runId: string;
  query: string;
  createdBy: string;
  prep: CallPrep;
  leads: Lead[];
}

export interface CallStore {
  createRun(params: CreateRunParams): RunSession;
  attachCallSid(callId: string, callSid: string): void;
  findCallBySid(callSid: string): CallSession | undefined;
  updateCallState(callId: string, state: CallState, extra?: Partial<Call>): void;
  appendTranscript(callId: string, turn: TranscriptTurn, sentiment?: Call['sentiment']): void;
  getRun(runId: string): RunSession | undefined;
  getCall(callId: string): CallSession | undefined;
  getConversationHistory(callId: string): Array<{ role: 'system' | 'assistant' | 'user'; content: string }>;
  getPrepForRun(runId: string): CallPrep | undefined;
  setListening(callId: string, isListening: boolean): void;
  setTakeOver(callId: string, isTakenOver: boolean): void;
  subscribe(runId: string, listener: (event: CallEvent) => void): void;
  unsubscribe(runId: string, listener: (event: CallEvent) => void): void;
}

