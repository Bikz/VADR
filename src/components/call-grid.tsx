'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Call, CallState, VADRRun } from '@/types';
import { CallTile } from './call-tile';
import { generateTranscriptTurn, getRandomTranscriptSet } from '@/lib/mock-data';

interface CallGridProps {
  run: VADRRun;
  onRunUpdate?: (run: VADRRun) => void;
  onComplete?: (calls: Call[]) => void;
}

const TERMINAL_STATES: CallState[] = ['completed', 'failed', 'voicemail'];

const isTerminal = (call: Call) => TERMINAL_STATES.includes(call.state);

export function CallGrid({ run, onRunUpdate, onComplete }: CallGridProps) {
  const [calls, setCalls] = useState<Call[]>(run.calls);
  const completionRef = useRef(run.status === 'completed');
  const signatureRef = useRef<string | null>(null);

  useEffect(() => {
    setCalls(run.calls);
    completionRef.current = run.status === 'completed';
    signatureRef.current = null;
  }, [run.id]);

  const updateCalls = useCallback(
    (updater: (previous: Call[]) => Call[]) => {
      setCalls(prev => {
        const next = updater(prev);
        return next === prev ? prev : next;
      });
    },
    []
  );

  const updateCallState = useCallback(
    (callId: string, newState: CallState, extra: Partial<Call> = {}) => {
      updateCalls(prev =>
        prev.map(call => {
          if (call.id !== callId) return call;

          const timingUpdates: Partial<Call> = {};
          if (newState === 'connected' && !call.startedAt) {
            timingUpdates.startedAt = Date.now();
          }
          if (TERMINAL_STATES.includes(newState)) {
            timingUpdates.endedAt = Date.now();
          }

          return { ...call, ...extra, ...timingUpdates, state: newState };
        })
      );
    },
    [updateCalls]
  );

  const startTranscriptSimulation = useCallback(
    (callId: string) => {
      const transcriptSet = getRandomTranscriptSet();
      const baseTime = Date.now();
      let turnIndex = 0;
      let conversationIndex = 0;

      const addNextTurn = () => {
        if (conversationIndex >= transcriptSet[0].texts.length) {
          setTimeout(() => updateCallState(callId, 'completed'), 800);
          return;
        }

        const humanTurn = generateTranscriptTurn(
          callId,
          turnIndex++,
          'human',
          transcriptSet[0].texts[conversationIndex],
          baseTime
        );

        updateCalls(prev =>
          prev.map(call =>
            call.id === callId
              ? {
                  ...call,
                  transcript: [...call.transcript, humanTurn],
                  duration: Math.floor((Date.now() - baseTime) / 1000)
                }
              : call
          )
        );

        setTimeout(() => {
          const aiTurn = generateTranscriptTurn(
            callId,
            turnIndex++,
            'ai',
            transcriptSet[1].texts[conversationIndex],
            baseTime
          );

          updateCalls(prev =>
            prev.map(call =>
              call.id === callId
                ? {
                    ...call,
                    transcript: [...call.transcript, aiTurn],
                    duration: Math.floor((Date.now() - baseTime) / 1000),
                    sentiment: conversationIndex >= 2 ? 'positive' : 'neutral'
                  }
                : call
            )
          );

          conversationIndex++;
          if (conversationIndex < transcriptSet[0].texts.length) {
            setTimeout(addNextTurn, 2000 + Math.random() * 1000);
          } else {
            setTimeout(() => updateCallState(callId, 'completed'), 1500);
          }
        }, 1400 + Math.random() * 800);
      };

      setTimeout(addNextTurn, 600);
    },
    [updateCallState, updateCalls]
  );

  useEffect(() => {
    if (run.status === 'completed') {
      return;
    }

    const timers: NodeJS.Timeout[] = [];

    const kickoff = setTimeout(() => {
      updateCalls(prev =>
        prev.map((call, index) => {
          if (call.state !== 'idle') {
            return call;
          }

          const startedAt = Date.now();

          const ringingTimer = setTimeout(() => {
            updateCallState(call.id, 'ringing');

            const outcomeTimer = setTimeout(() => {
              const connects = Math.random() > 0.2;
              if (connects) {
                updateCallState(call.id, 'connected');
                startTranscriptSimulation(call.id);
              } else {
                updateCallState(call.id, 'voicemail');
              }
            }, 1800 + index * 350);

            timers.push(outcomeTimer);
          }, 1300 + index * 250);

          timers.push(ringingTimer);

          return { ...call, state: 'dialing', startedAt };
        })
      );
    }, 500);

    timers.push(kickoff);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [run.id, run.status, startTranscriptSimulation, updateCallState, updateCalls]);

  useEffect(() => {
    const status = calls.every(isTerminal) ? 'completed' : 'calling';

    const signature = calls
      .map(call =>
        [
          call.id,
          call.state,
          call.transcript.length,
          call.duration,
          call.sentiment,
          call.startedAt ?? 0,
          call.endedAt ?? 0
        ].join('-')
      )
      .join('|');

    const shouldEmit =
      signature !== signatureRef.current || status !== run.status;

    if (shouldEmit) {
      signatureRef.current = signature;

      onRunUpdate?.({
        id: run.id,
        query: run.query,
        createdBy: run.createdBy,
        startedAt: run.startedAt,
        status,
        calls
      });

      if (status === 'completed' && !completionRef.current) {
        completionRef.current = true;
        onComplete?.(calls);
      }

      if (status !== 'completed') {
        completionRef.current = false;
      }
    }
  }, [calls, onComplete, onRunUpdate, run.createdBy, run.id, run.query, run.startedAt, run.status]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 auto-rows-[1fr]">
      {calls.map(call => (
        <CallTile
          key={call.id}
          call={call}
          onUpdate={updates =>
            updateCalls(prev =>
              prev.map(existing =>
                existing.id === call.id ? { ...existing, ...updates } : existing
              )
            )
          }
          compact
        />
      ))}
    </div>
  );
}
