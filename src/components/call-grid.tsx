'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Call, VADRRun } from '@/types';
import { CallTile } from './call-tile';

interface CallGridProps {
  run: VADRRun;
  onRunUpdate?: (run: VADRRun) => void;
  onComplete?: (calls: Call[]) => void;
}

type EventPayload = { type: 'snapshot'; run: VADRRun };

export function CallGrid({ run, onRunUpdate, onComplete }: CallGridProps) {
  const [runState, setRunState] = useState<VADRRun>(run);
  const [callsById, setCallsById] = useState<Record<string, Call>>(
    Object.fromEntries(run.calls.map((call) => [call.id, call]))
  );
  const orderRef = useRef<string[]>(run.calls.map((call) => call.id));
  const completionRef = useRef(run.status === 'completed');

  useEffect(() => {
    setRunState(run);
    setCallsById(Object.fromEntries(run.calls.map((call) => [call.id, call])));
    orderRef.current = run.calls.map((call) => call.id);
    completionRef.current = run.status === 'completed';
  }, [run]);

  useEffect(() => {
    const source = new EventSource(`/api/events?runId=${run.id}`);

    source.onmessage = (message) => {
      if (!message.data) return;
      try {
        const payload = JSON.parse(message.data) as EventPayload;
        if (payload.type === 'snapshot') {
          setRunState(payload.run);
          onRunUpdate?.(payload.run);

          setCallsById(
            Object.fromEntries(payload.run.calls.map((call) => [call.id, call]))
          );
          orderRef.current = payload.run.calls.map((call) => call.id);

          if (payload.run.status === 'completed' && !completionRef.current) {
            completionRef.current = true;
            onComplete?.(payload.run.calls);
          } else if (payload.run.status !== 'completed') {
            completionRef.current = false;
          }
        }
      } catch (error) {
        console.error('Failed to parse event payload', error);
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      completionRef.current = runState.status === 'completed';
      source.close();
    };
  }, [onComplete, onRunUpdate, run.id, runState.status]);

  const orderedCalls = useMemo(() => {
    const entries = orderRef.current.map((id) => callsById[id]).filter(Boolean);
    return entries;
  }, [callsById]);

  const optimisticUpdate = useCallback((callId: string, updates: Partial<Call>) => {
    setCallsById((previous) => {
      const existing = previous[callId];
      if (!existing) return previous;
      return {
        ...previous,
        [callId]: { ...existing, ...updates },
      };
    });
  }, []);

  const handleToggleListen = useCallback(
    async (call: Call, nextState: boolean) => {
      optimisticUpdate(call.id, { isListening: nextState });
      try {
        await fetch(`/api/calls/${call.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isListening: nextState }),
        });
      } catch (error) {
        console.error('Failed to toggle listen state', error);
      }
    },
    [optimisticUpdate]
  );

  const handleToggleTakeOver = useCallback(
    async (call: Call, nextState: boolean) => {
      optimisticUpdate(call.id, { isTakenOver: nextState });
      try {
        await fetch(`/api/calls/${call.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isTakenOver: nextState }),
        });
      } catch (error) {
        console.error('Failed to toggle takeover', error);
      }
    },
    [optimisticUpdate]
  );

  const handleEndCall = useCallback(
    async (call: Call) => {
      optimisticUpdate(call.id, { state: 'completed' });
      try {
        await fetch(`/api/calls/${call.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endCall: true }),
        });
      } catch (error) {
        console.error('Failed to end call', error);
      }
    },
    [optimisticUpdate]
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 auto-rows-[1fr]">
      {orderedCalls.map((call) => (
        <CallTile
          key={call.id}
          call={call}
          onToggleListen={handleToggleListen}
          onToggleTakeOver={handleToggleTakeOver}
          onEndCall={handleEndCall}
          compact
        />
      ))}
    </div>
  );
}
