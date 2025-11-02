export type CallState =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'voicemail'
  | 'completed'
  | 'failed';

export type Speaker = 'ai' | 'human';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface TranscriptTurn {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: number;
  t0_ms: number;
  t1_ms: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  url?: string;
  address?: string;
  confidence: number;
  rating: number;
  reviewCount: number;
  description: string;
}

export interface Call {
  id: string;
  leadId: string;
  lead: Lead;
  state: CallState;
  startedAt?: number;
  endedAt?: number;
  duration: number;
  transcript: TranscriptTurn[];
  sentiment: Sentiment;
  isListening: boolean;
  isTakenOver: boolean;
  extractedData?: {
    price?: string;
    availability?: string;
    notes?: string;
  };
}

export interface VADRRun {
  id: string;
  query: string;
  createdBy: string;
  startedAt: number;
  status: 'searching' | 'calling' | 'completed';
  calls: Call[];
}

export interface CallPrep {
  objective: string;
  script: string;
  variables: Record<string, string>;
  redFlags: string[];
  disallowedTopics: string[];
}
