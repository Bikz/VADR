'use client';

import { useEffect, useState } from 'react';
import { PhoneCall, PhoneMissed, MapPin, Clock, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Call, VADRRun, CallState } from '@/types';
import { apiClient } from '@/lib/api-client';
import { generateTestCalls } from '@/lib/test-data';
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
    const businessesParam = params.get('businesses');
    const queryParam = params.get('query');

    // If businesses are provided, create calls from them
    if (businessesParam) {
      try {
        const businesses = JSON.parse(decodeURIComponent(businessesParam)) as any[];
        const query = queryParam ? decodeURIComponent(queryParam) : 'Selected businesses';
        
        // Create calls from the businesses with initial state
        const callsFromBusinesses: Call[] = businesses.map((business, index) => ({
          id: `call-${business.id || index}`,
          leadId: business.id,
          lead: business,
          state: 'dialing' as CallState,
          startedAt: Date.now(),
          endedAt: undefined,
          duration: 0,
          transcript: [],
          sentiment: 'neutral' as const,
          isListening: false,
          isTakenOver: false,
        }));

        setCalls(callsFromBusinesses);
        setRun({
          id: `run-from-selection-${Date.now()}`,
          query: query,
          calls: callsFromBusinesses,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return;
      } catch (error) {
        console.error('Failed to parse businesses from URL:', error);
      }
    }

    // If no runId, use mock data showing all call statuses
    if (!runId) {
      const allStatusCalls: Call[] = [
        // Dialing
        {
          id: 'call-dialing-1',
          leadId: 'lead-1',
          lead: {
            id: 'lead-1',
            name: 'Elite Salon & Spa',
            phone: '+14155551234',
            source: 'Google',
            confidence: 0.95,
            rating: 4.8,
            reviewCount: 247,
            description: 'Premium full-service salon',
            distance: 0.8,
          },
          state: 'dialing',
          startedAt: Date.now() - 5000,
          endedAt: undefined,
          duration: 5,
          transcript: [],
          sentiment: 'neutral',
          isListening: false,
          isTakenOver: false,
        },
        // Ringing
        {
          id: 'call-ringing-1',
          leadId: 'lead-2',
          lead: {
            id: 'lead-2',
            name: 'Modern Barber Shop',
            phone: '+14155552345',
            source: 'Yelp',
            confidence: 0.92,
            rating: 4.6,
            reviewCount: 189,
            description: 'Contemporary barbershop',
            distance: 1.2,
          },
          state: 'ringing',
          startedAt: Date.now() - 8000,
          endedAt: undefined,
          duration: 8,
          transcript: [],
          sentiment: 'neutral',
          isListening: false,
          isTakenOver: false,
        },
        // Connected
        {
          id: 'call-connected-1',
          leadId: 'lead-3',
          lead: {
            id: 'lead-3',
            name: 'Wellness Massage Center',
            phone: '+14155553456',
            source: 'Google',
            confidence: 0.88,
            rating: 4.9,
            reviewCount: 312,
            description: 'Therapeutic massage center',
            distance: 2.1,
          },
          state: 'connected',
          startedAt: Date.now() - 120000,
          endedAt: undefined,
          duration: 120,
          transcript: [
            {
              id: 't1',
              speaker: 'ai',
              text: "Hi, I'm calling about massage appointments. Do you have same-day availability?",
              timestamp: Date.now() - 118000,
              t0_ms: 0,
              t1_ms: 4200,
            },
            {
              id: 't2',
              speaker: 'human',
              text: 'Yes, we have availability at 6 PM and 7:30 PM today.',
              timestamp: Date.now() - 115000,
              t0_ms: 4200,
              t1_ms: 7800,
            },
          ],
          sentiment: 'positive',
          isListening: false,
          isTakenOver: false,
        },
        // Idle
        {
          id: 'call-idle-1',
          leadId: 'lead-4',
          lead: {
            id: 'lead-4',
            name: 'Quick Cuts Hair Studio',
            phone: '+14155554567',
            source: 'Yelp',
            confidence: 0.85,
            rating: 4.4,
            reviewCount: 156,
            description: 'Affordable haircuts',
            distance: 0.5,
          },
          state: 'idle',
          startedAt: Date.now() - 15000,
          endedAt: undefined,
          duration: 15,
          transcript: [],
          sentiment: 'neutral',
          isListening: false,
          isTakenOver: false,
        },
        // Voicemail
        {
          id: 'call-voicemail-1',
          leadId: 'lead-5',
          lead: {
            id: 'lead-5',
            name: 'Luxury Spa Retreat',
            phone: '+14155555678',
            source: 'Google',
            confidence: 0.93,
            rating: 4.7,
            reviewCount: 428,
            description: 'Upscale spa offering facials',
            distance: 3.2,
          },
          state: 'voicemail',
          startedAt: Date.now() - 45000,
          endedAt: Date.now() - 20000,
          duration: 25,
          transcript: [
            {
              id: 'vm1',
              speaker: 'human',
              text: 'You have reached the voicemail of Luxury Spa Retreat. Please leave a message.',
              timestamp: Date.now() - 43000,
              t0_ms: 2000,
              t1_ms: 8500,
            },
            {
              id: 'vm2',
              speaker: 'ai',
              text: 'Hi, this is VADR calling about appointment availability. Please call us back. Thank you!',
              timestamp: Date.now() - 40000,
              t0_ms: 8500,
              t1_ms: 13800,
            },
          ],
          sentiment: 'neutral',
          isListening: false,
          isTakenOver: false,
        },
        // Completed
        {
          id: 'call-completed-1',
          leadId: 'lead-6',
          lead: {
            id: 'lead-6',
            name: 'Style Studio',
            phone: '+14155556789',
            source: 'Google',
            confidence: 0.90,
            rating: 4.5,
            reviewCount: 203,
            description: 'Modern hair styling salon',
            distance: 1.5,
          },
          state: 'completed',
          startedAt: Date.now() - 360000,
          endedAt: Date.now() - 330000,
          duration: 30,
          transcript: [
            {
              id: 'c1',
              speaker: 'ai',
              text: "Hi, I'm calling about same-day appointment availability.",
              timestamp: Date.now() - 358000,
              t0_ms: 0,
              t1_ms: 3500,
            },
            {
              id: 'c2',
              speaker: 'human',
              text: 'Yes, we have availability. What time works for you?',
              timestamp: Date.now() - 356000,
              t0_ms: 3500,
              t1_ms: 6200,
            },
            {
              id: 'c3',
              speaker: 'ai',
              text: 'Any time after 2 PM would be perfect.',
              timestamp: Date.now() - 354000,
              t0_ms: 6200,
              t1_ms: 9800,
            },
            {
              id: 'c4',
              speaker: 'human',
              text: 'We have 3 PM and 4:30 PM available. Price is $65.',
              timestamp: Date.now() - 352000,
              t0_ms: 9800,
              t1_ms: 13200,
            },
          ],
          sentiment: 'positive',
          isListening: false,
          isTakenOver: false,
          extractedData: {
            price: '$65',
            availability: '3 PM, 4:30 PM',
            notes: 'Contacted about hair salons with same-day appointments',
          },
        },
        // Failed
        {
          id: 'call-failed-1',
          leadId: 'lead-7',
          lead: {
            id: 'lead-7',
            name: 'Downtown Haircuts',
            phone: '+14155557890',
            source: 'Yelp',
            confidence: 0.87,
            rating: 4.3,
            reviewCount: 134,
            description: 'Quick service barbershop',
            distance: 2.8,
          },
          state: 'failed',
          startedAt: Date.now() - 60000,
          endedAt: Date.now() - 55000,
          duration: 5,
          transcript: [],
          sentiment: 'neutral',
          isListening: false,
          isTakenOver: false,
        },
      ];
      
      setCalls(allStatusCalls);
      // Create a mock run object
      setRun({
        id: 'test-run-all-statuses',
        query: 'hair salons with same-day appointments',
        calls: allStatusCalls,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return;
    }

    // If runId exists, connect to real data via EventSource
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

  // Navigate to summaries when all calls are completed or failed
  useEffect(() => {
    if (calls.length === 0) return;

    const allFinished = calls.every(call => 
      call.state === 'completed' || call.state === 'failed'
    );

    if (allFinished) {
      // Wait a moment before navigating to show the final state
      const timer = setTimeout(() => {
        // Pass calls data to summaries page via URL params
        const callsJson = encodeURIComponent(JSON.stringify(calls));
        const query = run?.query ? encodeURIComponent(run.query) : '';
        router.push(`/summaries?calls=${callsJson}&query=${query}`);
      }, 2000); // 2 second delay to show final state

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
