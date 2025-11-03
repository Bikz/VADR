'use client';

import { useEffect, useState } from 'react';
import { PhoneCall, PhoneMissed, MapPin, Clock, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Call, VADRRun, CallState } from '@vadr/shared';
import { apiClient } from '@/lib/api-client';
import dynamic from 'next/dynamic';

const AnimatedCallIcon = dynamic(
  () => import('@/components/animated-call-icon').then((mod) => ({ default: mod.AnimatedCallIcon })),
  {
    ssr: false,
    loading: () => <div className="w-8 h-8" /> // Placeholder while loading
  }
);

const AnimatedVoicemailIcon = dynamic(
  () => import('@/components/animated-voicemail-icon').then((mod) => ({ default: mod.AnimatedVoicemailIcon })),
  {
    ssr: false,
    loading: () => <div className="w-8 h-8" /> // Placeholder while loading
  }
);

interface CallCardProps {
  call: Call;
  onViewTranscript: (callId: string) => void;
  onCancelCall: (callId: string) => void;
  onMarkComplete: (callId: string) => void;
}

function getStatusColor(state: CallState): string {
  switch (state) {
    case 'dialing':
      return 'bg-[#FFC105]';
    case 'ringing':
      return 'bg-[#FFD557]';
    case 'connected':
      return 'bg-[#82EE71]';
    case 'voicemail':
      return 'bg-[#E8BB82]';
    case 'idle':
      return 'bg-[#EDD2B0]';
    case 'completed':
      return 'bg-[#90D3FF]';
    case 'failed':
      return 'bg-[#E99E9E]';
    default:
      return 'bg-[#EDD2B0]';
  }
}

function getStatusLabel(state: CallState): string {
  switch (state) {
    case 'dialing':
      return 'Dialing...';
    case 'ringing':
      return 'Dialing...';
    case 'connected':
      return '';
    case 'voicemail':
      return 'Voicemail';
    case 'idle':
      return 'Waiting';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Waiting';
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimestamp(timestamp: number): string {
  const seconds = Math.floor(timestamp / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function CallCard({ call, onViewTranscript, onCancelCall, onMarkComplete }: CallCardProps) {
  const [duration, setDuration] = useState(call.duration ?? 0);

  useEffect(() => {
    if (call.state === 'connected' && call.startedAt) {
      const interval = setInterval(() => {
        setDuration(Math.round((Date.now() - call.startedAt!) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [call.startedAt, call.state]);

  const events: string[] = [];

  if (call.transcript.length > 0) {
    const sortedTranscript = [...call.transcript].sort((a, b) => b.t0_ms - a.t0_ms);
    for (let i = 0; i < Math.min(4, sortedTranscript.length); i++) {
      const turn = sortedTranscript[i];
      const time = formatTimestamp(turn.t0_ms);
      const speaker = turn.speaker === 'ai' ? 'Tara' : call.lead.name.split(' ')[0];
      events.push(`${time}  ${speaker}: ${turn.text.substring(0, 40)}${turn.text.length > 40 ? '...' : ''}`);
    }
  } else if (call.startedAt) {
    events.push(`00:00  Tara called ${call.lead.name}`);
  }

  const transcriptEventCount = events.length;
  const maxHeight = 600;
  const minHeight = 380;
  const baseHeight = minHeight;
  const heightPerEvent = 25;
  const calculatedHeight = Math.min(maxHeight, baseHeight + (transcriptEventCount * heightPerEvent));

  const isSmallCard = call.state === 'dialing' || call.state === 'ringing' || call.state === 'idle';
  const cardHeight = isSmallCard ? 216 : calculatedHeight;
  const failureReason = call.state === 'failed' ? (call as any).failureReason || 'No answer' : null;

  return (
    <div className={`flex-shrink-0 w-[514px] rounded-[39px] border-2 border-[#523429] overflow-hidden`} style={{ height: `${cardHeight}px` }}>
      <div className="h-[85px] rounded-t-[39px] bg-[#FEE9CF] border-b-2 border-[#523429] px-4 py-4 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-full border-2 border-[#523429] overflow-hidden bg-[#D4A574] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="#8B5E3C"/>
            </svg>
          </div>
          <div>
            <h3 className="font-inter text-[18px] font-bold text-[#513529] leading-tight">
              {call.lead.name}
            </h3>
            <p className="font-inter text-[14px] font-normal text-[#513529]/50">
              {call.lead.phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-inter text-[14px] font-medium text-[#513529]/50">
            {formatDuration(duration)}
          </span>
          {call.state !== 'connected' && (
            <div className={`px-2 py-1 rounded-[42px] ${getStatusColor(call.state)} flex items-center justify-center min-w-[94px] ${call.state === 'dialing' || call.state === 'ringing' ? 'animate-shake' : ''}`}>
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                {getStatusLabel(call.state)}
              </span>
            </div>
          )}
          {call.state === 'voicemail' && (
            <AnimatedVoicemailIcon size={32} iconColor="#523429" waveColor="#523429" />
          )}
          {call.state === 'failed' && (
            <PhoneMissed className="w-5 h-5 text-[#523429]" />
          )}
          {call.state === 'connected' && (
            <AnimatedCallIcon size={32} iconColor="#82EE71" waveColor="#82EE71" />
          )}
          {call.state === 'completed' && (
            <PhoneCall className="w-5 h-5 text-[#523429]" />
          )}
        </div>
      </div>

      {!isSmallCard && (
        <div className="h-[calc(100%-85px)] bg-white flex flex-col">
          <div className="flex-1 px-4 py-4 overflow-y-auto">
            <div className="space-y-1">
              {events.map((event, index) => (
                <p key={index} className="font-inter text-[14px] font-normal text-[#513529]/50 leading-[150%]">
                  • {event}
                </p>
              ))}
            </div>

            {(call.extractedData || call.lead.address) && (
              <>
                <div className="border-t border-[#523429] my-4" />
                <div className="space-y-1.5">
                  {call.extractedData?.price && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="w-[14px] h-[14px] text-[#523429] mt-0.5 flex-shrink-0" />
                      <span className="font-inter text-[14px] font-medium text-[#523429]">
                        Price: {call.extractedData.price}
                      </span>
                    </div>
                  )}
                  {call.extractedData?.availability && (
                    <div className="flex items-start gap-2">
                      <Clock className="w-[14px] h-[14px] text-[#523429] mt-0.5 flex-shrink-0" />
                      <span className="font-inter text-[14px] font-medium text-[#523429]">
                        Availability: {call.extractedData.availability}
                      </span>
                    </div>
                  )}
                  {call.lead.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-[14px] h-[14px] text-[#523429] mt-0.5 flex-shrink-0" />
                      <span className="font-inter text-[14px] font-medium text-[#523429]">
                        Address: {call.lead.address}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {call.state === 'failed' && failureReason && (
              <div className="mt-4 p-3 rounded-lg bg-[#E99E9E]/20 border border-[#E99E9E]">
                <p className="font-inter text-[12px] font-medium text-[#523429]">
                  Failure reason: {failureReason}
                </p>
              </div>
            )}
          </div>

          <div className="border-t-2 border-[#523429] h-[1px]" />

          <div className="px-4 py-4 flex items-center justify-center gap-3">
            <button
              onClick={() => onViewTranscript(call.id)}
              className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center"
            >
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                View Transcript
              </span>
            </button>
            <button
              onClick={() => onCancelCall(call.id)}
              className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center"
            >
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Cancel Call
              </span>
            </button>
            <button
              onClick={() => onMarkComplete(call.id)}
              className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center"
            >
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Mark Complete
              </span>
            </button>
            {(call.state === 'connected' || call.state === 'ringing') && (
              <button
                onClick={() => onViewTranscript(call.id)}
                className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#523429] hover:bg-[#523429]/90 text-white transition-colors flex items-center justify-center"
              >
                <span className="font-inter text-[12px] font-bold tracking-[-0.48px]">
                  Take Over
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {isSmallCard && (
        <div className="h-[calc(216px-85px)] bg-white flex flex-col">
          <div className="flex-1 px-4 py-4">
            <p className="font-inter text-[14px] font-normal text-[#513529]/50 leading-[150%]">
              • 00:00  Tara called {call.lead.name}
            </p>
          </div>
          <div className="px-4 py-4 flex items-center justify-center gap-3">
            <button
              onClick={() => onViewTranscript(call.id)}
              className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center"
            >
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                View Transcript
              </span>
            </button>
            <button
              onClick={() => onCancelCall(call.id)}
              className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center"
            >
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Cancel Call
              </span>
            </button>
            <button
              onClick={() => onMarkComplete(call.id)}
              className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center"
            >
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Mark Complete
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  const router = useRouter();
  const [run, setRun] = useState<VADRRun | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const runId = params.get('runId');

    // Must have a runId to connect to real data
    if (!runId) {
      console.warn('No runId provided. Cannot load calls.');
      return;
    }

    // Connect to real data via EventSource
    const source = apiClient.createEventSource('/api/events', { runId });

    source.onmessage = (message) => {
      const payload = apiClient.parseEvent(message.data);
      if (!payload) return;
      if (payload.type === 'snapshot') {
        setRun(payload.run);
        setCalls(payload.run.calls);
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, []);

  // Auto-mark voicemail calls as completed after they finish
  useEffect(() => {
    const voicemailCalls = calls.filter(call => call.state === 'voicemail' && !call.endedAt);

    if (voicemailCalls.length === 0) return;

    // Simulate voicemail completion after a delay (e.g., 5 seconds)
    const timers = voicemailCalls.map(call => {
      return setTimeout(() => {
        // Only mark as completed if still in voicemail state
        setCalls(prevCalls => {
          const updated = prevCalls.map(c => {
            if (c.id === call.id && c.state === 'voicemail' && !c.endedAt) {
              return { ...c, state: 'completed' as CallState, endedAt: Date.now() };
            }
            return c;
          });

          // Update run state as well
          setRun(prevRun => {
            if (!prevRun) return prevRun;
            return {
              ...prevRun,
              calls: updated,
              updatedAt: Date.now(),
            };
          });

          return updated;
        });
      }, 5000); // 5 second delay to simulate leaving voicemail
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [calls]);

  // Redirect to summaries when all calls are complete
  useEffect(() => {
    if (calls.length === 0 || !run) return;

    const allCallsComplete = calls.every(call =>
      call.state === 'completed' || call.state === 'failed' || call.state === 'voicemail'
    );

    if (allCallsComplete) {
      // Wait a moment to show the final state before redirecting
      const timer = setTimeout(() => {
        const callsParam = encodeURIComponent(JSON.stringify(calls));
        const queryParam = encodeURIComponent(run.query);
        router.push(`/summaries?calls=${callsParam}&query=${queryParam}`);
      }, 2000); // 2 second delay

      return () => clearTimeout(timer);
    }
  }, [calls, run, router]);

  const handleViewTranscript = (callId: string) => {
    console.log('View transcript for call:', callId);
  };

  const handleCancelCall = async (callId: string) => {
    // Update local state immediately
    setCalls(prevCalls =>
      prevCalls.map(call =>
        call.id === callId
          ? { ...call, state: 'failed' as CallState, endedAt: Date.now() }
          : call
      )
    );

    // Update run state
    setRun(prevRun => {
      if (!prevRun) return prevRun;
      return {
        ...prevRun,
        calls: prevRun.calls.map(call =>
          call.id === callId
            ? { ...call, state: 'failed' as CallState, endedAt: Date.now() }
            : call
        ),
        updatedAt: Date.now(),
      };
    });

    // Optionally call API (don't fail if it fails)
    try {
      await apiClient.updateCall(callId, { action: 'end' });
    } catch (error) {
      console.error('Failed to cancel call via API:', error);
    }
  };

  const handleMarkComplete = async (callId: string) => {
    // Update local state immediately
    setCalls(prevCalls =>
      prevCalls.map(call =>
        call.id === callId
          ? { ...call, state: 'completed' as CallState, endedAt: Date.now() }
          : call
      )
    );

    // Update run state
    setRun(prevRun => {
      if (!prevRun) return prevRun;
      return {
        ...prevRun,
        calls: prevRun.calls.map(call =>
          call.id === callId
            ? { ...call, state: 'completed' as CallState, endedAt: Date.now() }
            : call
        ),
        updatedAt: Date.now(),
      };
    });

    // Optionally call API (don't fail if it fails)
    try {
      await apiClient.updateCall(callId, { action: 'end' });
    } catch (error) {
      console.error('Failed to mark complete via API:', error);
    }
  };

  if (!run) {
    return (
      <div className="min-h-screen bg-[#FFF5E5] flex items-center justify-center">
        <div className="text-[#513529]/50 font-inter text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF5E5]">
      <div className="px-14 py-8">
        <button
          onClick={() => router.push('/')}
          className="mb-16 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="relative h-[22px] w-[22px] flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="11" fill="#D4A574"/>
              <circle cx="11" cy="11" r="8.3" fill="#8B5E3C"/>
              <path d="M5.9 11C5.9 8.2 8.2 5.9 11 5.9C13.8 5.9 16.1 8.2 16.1 11C16.1 13.8 13.8 16.1 11 16.1" stroke="#F4E4CB" strokeWidth="0.9"/>
            </svg>
          </div>
          <h1 className="font-kodchasan text-[25px] font-normal tracking-[-0.991px] leading-none text-[#523429]">
            TARA
          </h1>
        </button>

        <div className="mb-8">
          <p className="font-inter text-[24px] font-medium tracking-[-0.96px] text-[#513529]/50 mb-2">
            ACTIVE QUERY
          </p>
          <h2 className="font-inter text-[32px] font-bold tracking-[-1.28px] text-[#513529] mb-3">
            {run.query}
          </h2>
          <p className="font-inter text-[18px] font-medium tracking-[-0.72px] text-[#513529]/50">
            Calls happen instantly and update in real time
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {calls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              onViewTranscript={handleViewTranscript}
              onCancelCall={handleCancelCall}
              onMarkComplete={handleMarkComplete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
