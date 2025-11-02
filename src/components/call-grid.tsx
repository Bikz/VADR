'use client';

import { useEffect, useState } from 'react';
import type { VADRRun, Call, CallState } from '@/types';
import { CallTile } from './call-tile';
import { getRandomTranscriptSet, generateTranscriptTurn } from '@/lib/mock-data';

interface CallGridProps {
  run: VADRRun;
  onRunUpdate: (run: VADRRun) => void;
}

export function CallGrid({ run, onRunUpdate }: CallGridProps) {
  const [calls, setCalls] = useState(run.calls);

  useEffect(() => {
    setCalls(run.calls);

    // Simulate call progression
    const timeout = setTimeout(() => {
      const updatedCalls = calls.map((call, index) => {
        if (call.state === 'idle') {
          return { ...call, state: 'dialing' as CallState, startedAt: Date.now() };
        }
        return call;
      });
      setCalls(updatedCalls);
      onRunUpdate({ ...run, calls: updatedCalls, status: 'calling' });
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // Simulate state transitions
    const intervals: NodeJS.Timeout[] = [];

    calls.forEach((call, index) => {
      if (call.state === 'dialing') {
        const interval = setTimeout(() => {
          updateCallState(call.id, 'ringing');
        }, 1500 + index * 300);
        intervals.push(interval);
      } else if (call.state === 'ringing') {
        const interval = setTimeout(() => {
          // 80% connect, 20% voicemail
          const nextState = Math.random() > 0.2 ? 'connected' : 'voicemail';
          updateCallState(call.id, nextState);

          if (nextState === 'connected') {
            startTranscriptSimulation(call.id);
          }
        }, 2000 + index * 400);
        intervals.push(interval);
      }
    });

    return () => intervals.forEach(clearTimeout);
  }, [calls]);

  const updateCallState = (callId: string, newState: CallState) => {
    setCalls(prev => prev.map(call =>
      call.id === callId ? { ...call, state: newState } : call
    ));
  };

  const updateCall = (callId: string, updates: Partial<Call>) => {
    setCalls(prev => prev.map(call =>
      call.id === callId ? { ...call, ...updates } : call
    ));
  };

  const startTranscriptSimulation = (callId: string) => {
    const call = calls.find(c => c.id === callId);
    if (!call) return;

    const transcriptSet = getRandomTranscriptSet();
    const baseTime = Date.now();
    let turnIndex = 0;
    let conversationIndex = 0;

    const addNextTurn = () => {
      if (conversationIndex >= transcriptSet[0].texts.length) {
        // End call
        setTimeout(() => {
          updateCallState(callId, 'completed');
        }, 1000);
        return;
      }

      // Add human response
      const humanTurn = generateTranscriptTurn(
        callId,
        turnIndex++,
        'human',
        transcriptSet[0].texts[conversationIndex],
        baseTime
      );

      updateCall(callId, {
        transcript: [...(calls.find(c => c.id === callId)?.transcript || []), humanTurn],
        duration: Math.floor((Date.now() - baseTime) / 1000)
      });

      // Add AI response after delay
      setTimeout(() => {
        const aiTurn = generateTranscriptTurn(
          callId,
          turnIndex++,
          'ai',
          transcriptSet[1].texts[conversationIndex],
          baseTime
        );

        updateCall(callId, {
          transcript: [...(calls.find(c => c.id === callId)?.transcript || []), aiTurn],
          duration: Math.floor((Date.now() - baseTime) / 1000),
          sentiment: conversationIndex >= 2 ? 'positive' : 'neutral'
        });

        conversationIndex++;

        // Schedule next turn
        if (conversationIndex < transcriptSet[0].texts.length) {
          setTimeout(addNextTurn, 2000 + Math.random() * 1000);
        } else {
          setTimeout(() => updateCallState(callId, 'completed'), 2000);
        }
      }, 1500 + Math.random() * 1000);
    };

    // Start first turn
    setTimeout(addNextTurn, 800);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {calls.map((call) => (
        <CallTile
          key={call.id}
          call={call}
          onUpdate={(updates) => updateCall(call.id, updates)}
        />
      ))}
    </div>
  );
}
