'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Call, VADRRun } from '@/types';
import { CallTile } from './call-tile';
import { apiClient } from '@/lib/api-client';

interface CallGridProps {
  run: VADRRun;
  onRunUpdate?: (run: VADRRun) => void;
  onComplete?: (calls: Call[]) => void;
}

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
    const source = apiClient.createEventSource('/api/events', { runId: run.id });

    source.onmessage = (message) => {
      const payload = apiClient.parseEvent(message.data);
      if (!payload) return;
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
        await apiClient.updateCall(call.id, {
          action: 'listen',
          value: nextState,
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
        await apiClient.updateCall(call.id, {
          action: 'takeover',
          value: nextState,
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
        await apiClient.updateCall(call.id, {
          action: 'end',
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
