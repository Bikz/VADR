'use client';

import { useEffect, useState, useRef } from 'react';
import { PhoneCall, Hand, Mic, Volume2, Play, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Call, CallState } from '@/types';
import { apiClient } from '@/lib/api-client';
import { speakText } from '@/lib/elevenlabs-client';
import { DemoVoiceControl } from '@/components/demo-voice-control';

interface DemoCallCardProps {
  call: Call;
  onTakeOver: () => void;
  onSimulateNext: () => void;
  isSimulating: boolean;
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
      return 'Ringing...';
    case 'connected':
      return 'Connected';
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

function DemoCallCard({ call, onTakeOver, onSimulateNext, isSimulating }: DemoCallCardProps) {
  const [duration, setDuration] = useState(call.duration ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDuration(call.duration ?? 0);
  }, [call.duration]);

  useEffect(() => {
    if (call.state === 'connected' && call.startedAt) {
      const startedAt = call.startedAt;
      const interval = setInterval(() => {
        setDuration(Math.round((Date.now() - startedAt) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [call.startedAt, call.state]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [call.transcript]);

  const handlePlayLastMessage = async () => {
    const lastTurn = call.transcript[call.transcript.length - 1];
    if (!lastTurn || lastTurn.speaker === 'human') return;

    try {
      setIsPlaying(true);
      await speakText(lastTurn.text);
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  const lastMessage = call.transcript.length > 0 
    ? call.transcript[call.transcript.length - 1]?.text 
    : undefined;

  const isSmallCard = call.state === 'dialing' || call.state === 'ringing' || call.state === 'idle';

  return (
    <div className={`flex-shrink-0 ${isSmallCard ? 'w-[514px] h-[216px]' : 'w-[514px] min-h-[380px]'} rounded-[39px] border-2 border-[#523429] overflow-hidden flex flex-col`}>
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
          <div className={`px-2 py-1 rounded-[42px] ${getStatusColor(call.state)} flex items-center justify-center min-w-[94px] ${call.state === 'dialing' || call.state === 'ringing' ? 'animate-pulse' : ''}`}>
            <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
              {getStatusLabel(call.state)}
            </span>
          </div>
          {(call.state === 'connected' || call.state === 'completed') && (
            <PhoneCall className="w-5 h-5 text-[#523429]" />
          )}
        </div>
      </div>

      <div className="flex-1 bg-white flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 px-4 py-4 overflow-y-auto">
          {call.transcript.length === 0 ? (
            <p className="font-inter text-[14px] font-normal text-[#513529]/50 leading-[150%]">
              • 00:00  Tara called {call.lead.name}
            </p>
          ) : (
            <div className="space-y-3">
              {call.transcript.map((turn, index) => (
                <div key={`${turn.id}-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.25em] ${
                      turn.speaker === 'ai' ? 'text-[#513529]' : 'text-[#513529]/50'
                    }`}>
                      {turn.speaker === 'ai' ? 'TARA' : call.lead.name.split(' ')[0]}
                    </span>
                  </div>
                  <p className="font-inter text-[14px] font-normal text-[#513529]/70 leading-[150%] rounded-lg border border-[#523429]/20 bg-[#FEE9CF]/30 p-2">
                    {turn.text}
                  </p>
                </div>
              ))}
              {isSimulating && (
                <div className="flex items-center gap-2 text-[#513529]/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Generating response...</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t-2 border-[#523429] px-4 py-3">
          {call.state === 'connected' && !call.isTakenOver && (
            <div className="flex items-center gap-2">
              <button
                onClick={onSimulateNext}
                disabled={isSimulating || call.state === 'completed'}
                className="flex-1 h-[32px] px-3 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSimulating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                    Simulate Next Turn
                  </span>
                )}
              </button>
              <button
                onClick={onTakeOver}
                className="flex-1 h-[32px] px-3 rounded-md border border-[#523429] bg-[#6C5CE7] text-white hover:bg-[#5A4FD9] transition-colors flex items-center justify-center gap-1.5"
              >
                <Hand className="h-3.5 w-3.5" />
                <span className="font-inter text-[12px] font-bold tracking-[-0.48px]">
                  Take Over
                </span>
              </button>
              {lastMessage && call.transcript[call.transcript.length - 1]?.speaker === 'ai' && (
                <button
                  onClick={handlePlayLastMessage}
                  disabled={isPlaying}
                  className="h-[32px] w-[32px] rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isPlaying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-[#513529]" />
                  )}
                </button>
              )}
            </div>
          )}

          {call.isTakenOver && (
            <DemoVoiceControl
              callId={call.id}
              runId="demo-run"
              isTakenOver={true}
              onStartSpeaking={() => {}}
              onStopSpeaking={() => {}}
              lastMessage={lastMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function InteractiveDemoPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [runId] = useState(`demo-run-${Date.now()}`);
  const [isSimulating, setIsSimulating] = useState<Record<string, boolean>>({});
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize demo calls
  useEffect(() => {
    const demoLeads = [
      {
        id: 'lead-1',
        name: 'Downtown Cuts',
        phone: '(929) 233-5437',
        address: '245 Mission St, San Francisco',
        rating: 4.5,
        reviewCount: 120,
        source: 'Yelp',
        description: 'Hair salon specializing in modern cuts',
      },
      {
        id: 'lead-2',
        name: 'Elite Salon & Spa',
        phone: '(415) 555-0123',
        address: '789 Market St, San Francisco',
        rating: 4.8,
        reviewCount: 89,
        source: 'Google',
        description: 'Premium salon with walk-in availability',
      },
    ];

    const demoPrep = {
      objective: 'Find hair salons with walk-in availability today under $60',
      script: '1. Greet the business\n2. Ask about walk-in availability\n3. Inquire about pricing\n4. Thank them for their time',
      variables: {
        research_query: 'hair salons with walk-ins',
        max_price: '$60',
      },
      redFlags: ['No phone contact possible'],
      disallowedTopics: ['Making contractual promises'],
    };

    // Start demo calls
    const startDemo = async () => {
      try {
        const response = await apiClient.startCallRun({
          runId,
          query: 'Find hair salons with walk-in availability today under $60',
          leads: demoLeads,
          prep: demoPrep,
          createdBy: 'demo-user',
        });

        // Update state to simulate calls being connected
        setTimeout(() => {
          setCalls(response.run.calls.map(call => ({
            ...call,
            state: 'connected' as CallState,
            startedAt: Date.now(),
          })));

          // Start with initial Tara message for each call
          response.run.calls.forEach((call, index) => {
            setTimeout(() => {
              simulateInitialMessage(call.id);
            }, 1000 + index * 500);
          });
        }, 1500);
      } catch (error) {
        console.error('Failed to start demo:', error);
      }
    };

    startDemo();

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulateInitialMessage = async (callId: string) => {
    try {
      // Simulate first Tara message - start the conversation
      const result = await apiClient.simulateConversation(runId, callId, false);
      
      if (result.taraResponse) {
        // Play the audio
        try {
          await speakText(result.taraResponse);
        } catch (error) {
          console.error('Error playing audio:', error);
        }
      }
    } catch (error) {
      console.error('Error simulating initial message:', error);
    }
  };

  const handleSimulateNext = async (callId: string) => {
    setIsSimulating(prev => ({ ...prev, [callId]: true }));
    
    try {
      const result = await apiClient.simulateConversation(runId, callId, true);
      
      // Update calls state - we'll refresh via event source
      // The backend will update the transcript and state
      
      // Play Tara's response if available
      if (result.taraResponse) {
        try {
          await speakText(result.taraResponse);
        } catch (error) {
          console.error('Error playing audio:', error);
        }
      }
    } catch (error) {
      console.error('Error simulating conversation:', error);
    } finally {
      setIsSimulating(prev => ({ ...prev, [callId]: false }));
    }
  };

  const handleTakeOver = async (callId: string) => {
    try {
      await apiClient.updateCall(callId, { action: 'takeover', value: true });
      setCalls(prev => prev.map(call => 
        call.id === callId ? { ...call, isTakenOver: true } : call
      ));
    } catch (error) {
      console.error('Error taking over call:', error);
    }
  };

  // Subscribe to events to get real-time updates
  useEffect(() => {
    const eventSource = apiClient.createEventSource('/api/events', { runId });
    
    eventSource.onmessage = (event) => {
      const data = apiClient.parseEvent(event.data);
      if (data?.type === 'snapshot') {
        setCalls(data.run.calls);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId]);

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
            TARA - Interactive Demo
          </h1>
        </button>

        <div className="mb-8">
          <p className="font-inter text-[24px] font-medium tracking-[-0.96px] text-[#513529]/50 mb-2">
            INTERACTIVE DEMO
          </p>
          <h2 className="font-inter text-[32px] font-bold tracking-[-1.28px] text-[#513529] mb-3">
            Simulated conversations with voice takeover
          </h2>
          <p className="font-inter text-[18px] font-medium tracking-[-0.72px] text-[#513529]/50">
            Watch AI simulate both sides, then take over mid-conversation using ElevenLabs voice
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {calls.map((call) => (
            <DemoCallCard
              key={call.id}
              call={call}
              onTakeOver={() => handleTakeOver(call.id)}
              onSimulateNext={() => handleSimulateNext(call.id)}
              isSimulating={isSimulating[call.id] || false}
            />
          ))}
        </div>

        {calls.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#513529]" />
            <span className="ml-3 font-inter text-[18px] text-[#513529]/50">Starting demo calls...</span>
          </div>
        )}
      </div>
    </div>
  );
}

