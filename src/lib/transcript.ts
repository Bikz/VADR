import type { Speaker, TranscriptTurn } from '@/types';

export function createTranscriptTurn(callId: string, speaker: Speaker, text: string): TranscriptTurn {
  const now = Date.now();
  const duration = Math.max(500, text.length * 45);
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${now}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: `${callId}-${speaker}-${suffix}`,
    speaker,
    text,
    timestamp: now,
    t0_ms: now,
    t1_ms: now + duration,
  };
}

