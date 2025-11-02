import type { Call, CallPrep, CallState, Lead, TranscriptTurn, VADRRun } from '@vadr/shared';

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
  createRun(params: CreateRunParams): Promise<RunSession>;
  attachCallSid(callId: string, callSid: string): Promise<void>;
  findCallBySid(callSid: string): Promise<CallSession | undefined>;
  updateCallState(callId: string, state: CallState, extra?: Partial<Call>): Promise<void>;
  appendTranscript(callId: string, turn: TranscriptTurn, sentiment?: Call['sentiment']): Promise<void>;
  getRun(runId: string): Promise<RunSession | undefined>;
  getCall(callId: string): Promise<CallSession | undefined>;
  getConversationHistory(callId: string): Promise<Array<{ role: 'system' | 'assistant' | 'user'; content: string }>>;
  getPrepForRun(runId: string): Promise<CallPrep | undefined>;
  setListening(callId: string, isListening: boolean): Promise<void>;
  setTakeOver(callId: string, isTakenOver: boolean): Promise<void>;
}
