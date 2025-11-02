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
  const runRef = useRef(run);
  const completionRef = useRef(run.status === 'completed');

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    setCalls(run.calls);
    completionRef.current = run.status === 'completed';
  }, [run.id]);

  const syncRun = useCallback(
    (nextCalls: Call[]) => {
      const status = nextCalls.every(isTerminal) ? 'completed' : 'calling';
      const updatedRun: VADRRun = { ...runRef.current, calls: nextCalls, status };
      onRunUpdate?.(updatedRun);

      if (status === 'completed' && !completionRef.current) {
        completionRef.current = true;
        onComplete?.(nextCalls);
      }
    },
    [onComplete, onRunUpdate]
  );

  const setCallsAndNotify = useCallback(
    (updater: (previous: Call[]) => Call[]) => {
      setCalls(prev => {
        const next = updater(prev);
        if (next === prev) {
          return prev;
        }
        syncRun(next);
        return next;
      });
    },
    [syncRun]
  );

  const updateCallState = useCallback(
    (callId: string, newState: CallState, extra: Partial<Call> = {}) => {
      setCallsAndNotify(prev =>
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
    [setCallsAndNotify]
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

        setCallsAndNotify(prev =>
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

          setCallsAndNotify(prev =>
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
    [setCallsAndNotify, updateCallState]
  );

  useEffect(() => {
    if (run.status === 'completed') {
      return;
    }

    const kickoff = setTimeout(() => {
      setCallsAndNotify(prev =>
        prev.map(call =>
          call.state === 'idle'
            ? { ...call, state: 'dialing', startedAt: Date.now() }
            : call
        )
      );
    }, 500);

    return () => clearTimeout(kickoff);
  }, [run.id, run.status, setCallsAndNotify]);

  useEffect(() => {
    if (run.status === 'completed') {
      return;
    }

    const timers: NodeJS.Timeout[] = [];

    calls.forEach((call, index) => {
      if (call.state === 'dialing') {
        const timer = setTimeout(() => {
          updateCallState(call.id, 'ringing');
        }, 1300 + index * 250);
        timers.push(timer);
      } else if (call.state === 'ringing') {
        const timer = setTimeout(() => {
          const connects = Math.random() > 0.2;
          if (connects) {
            updateCallState(call.id, 'connected');
            startTranscriptSimulation(call.id);
          } else {
            updateCallState(call.id, 'voicemail');
          }
        }, 1800 + index * 350);
        timers.push(timer);
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [calls, run.status, startTranscriptSimulation, updateCallState]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 auto-rows-[1fr]">
      {calls.map(call => (
        <CallTile
          key={call.id}
          call={call}
          onUpdate={updates =>
            setCallsAndNotify(prev =>
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
