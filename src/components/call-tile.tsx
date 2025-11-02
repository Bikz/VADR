'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Hand, Play, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Call } from '@/types';
import { getStateColor, getSentimentColor } from '@/lib/call-style';
import dynamic from 'next/dynamic';
import { useCallAudio } from '@/hooks/use-call-audio';
import { useRouter } from 'next/navigation';

const AnimatedCallIcon = dynamic(() => import('./animated-call-icon').then(mod => ({ default: mod.AnimatedCallIcon })), {
  ssr: false,
});

interface CallTileProps {
  call: Call;
  onToggleListen: (call: Call, nextState: boolean) => Promise<void> | void;
  onToggleTakeOver: (call: Call, nextState: boolean) => Promise<void> | void;
  onEndCall: (call: Call) => Promise<void> | void;
  compact?: boolean;
}

export function CallTile({ call, onToggleListen, onToggleTakeOver, onEndCall, compact = false }: CallTileProps) {
  const [duration, setDuration] = useState(call.duration ?? 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setDuration(call.duration ?? 0);
  }, [call.duration, call.id]);

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTakeOver = () => {
    onToggleTakeOver(call, !call.isTakenOver);
  };

  const handleListen = () => {
    onToggleListen(call, !call.isListening);
  };

  const handleEndCall = () => {
    onEndCall(call);
  };

  const cardHeight = compact ? 'h-[340px]' : 'h-[500px]';
  const headerSpacing = compact ? 'space-y-2 p-3' : 'space-y-3 p-4';
  const transcriptPadding = compact ? 'p-3' : 'p-4';
  const transcriptStack = compact ? 'space-y-2' : 'space-y-3';
  const summarySpacing = compact ? 'mt-3 pt-3' : 'mt-4 pt-4';
  const emptyStatePadding = compact ? 'py-4 text-[0.7rem]' : 'py-8 text-xs';
  const transcriptText = compact ? 'p-2.5 text-xs leading-relaxed' : 'p-3 text-sm leading-relaxed';

  useCallAudio(call.id, call.isListening && isHovered && call.state === 'connected');

  return (
    <Card
      className={`flex flex-col overflow-hidden border border-gray-200 bg-white shadow-sm ${cardHeight}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`${call.state !== 'connected' ? 'border-b border-gray-200' : ''} bg-white ${headerSpacing}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={`truncate font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
              {call.lead.name}
            </h3>
            <p className="font-mono text-[0.7rem] text-gray-500">{call.lead.phone}</p>
          </div>
          {call.state !== 'connected' && (
            <Badge
              variant="outline"
              className={`${getStateColor(call.state)} shrink-0 text-[0.6rem] uppercase tracking-[0.25em]`}
            >
              {call.state}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[0.7rem] text-gray-500">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-mono">{formatDuration(duration)}</span>
          </div>
          {call.state === 'connected' && (
            <Badge
              variant="outline"
              className={`${getSentimentColor(call.sentiment)} text-[0.6rem] uppercase tracking-[0.25em]`}
            >
              {call.sentiment}
            </Badge>
          )}
          <div className="flex-1" />
          <Badge
            variant="outline"
            className="border-gray-200 text-[0.6rem] uppercase tracking-[0.25em] text-gray-500"
          >
            {call.lead.source}
          </Badge>
        </div>

        {call.state === 'connected' && (
          <div className="flex items-center justify-center py-2">
            <AnimatedCallIcon 
              size={compact ? 48 : 64}
              iconColor="#82EE71"
              waveColor="#82EE71"
            />
          </div>
        )}
        {call.state === 'ringing' && (
          <div className="h-8" />
        )}
      </div>

      <ScrollArea className={`flex-1 bg-white ${transcriptPadding}`} ref={scrollRef}>
        <div className={transcriptStack}>
          {call.transcript.length === 0 && call.state !== 'completed' && (
            <p className={`${emptyStatePadding} text-center text-gray-500`}>
              {call.state === 'dialing' && 'Dialing...'}
              {call.state === 'ringing' && 'Ringing...'}
              {call.state === 'voicemail' && 'Voicemail detected'}
              {call.state === 'idle' && 'Waiting...'}
            </p>
          )}

          {call.transcript.map((turn) => (
            <div key={`${turn.id}-${turn.t0_ms}`} className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[0.6rem] font-semibold uppercase tracking-[0.25em] ${
                    turn.speaker === 'ai' ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {turn.speaker === 'ai' ? 'TARA' : call.lead.name.split(' ')[0]}
                </span>
              </div>
              <p className={`rounded-lg border border-gray-200 bg-gray-50 text-gray-700 ${transcriptText}`}>
                {turn.text}
              </p>
            </div>
          ))}

          {call.state === 'completed' && call.transcript.length > 0 && (
            <div className={`border-t border-gray-200 ${summarySpacing}`}>
              <p className="mb-1 text-[0.6rem] font-medium uppercase tracking-[0.3em] text-gray-500">Summary</p>
              <div className="space-y-1 text-[0.7rem] text-gray-500">
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="text-gray-700">{formatDuration(duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Turns</span>
                  <span className="text-gray-700">{call.transcript.length}</span>
                </div>
              </div>
            </div>
          )}

          {call.state === 'voicemail' && (
            <div className="py-6 text-center">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                <MicOff className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-sm text-gray-600">Voicemail detected</p>
              <p className="mt-1 text-xs text-gray-500">Left automated message</p>
            </div>
          )}

          {call.state === 'failed' && (
            <div className="py-6 text-center">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                <PhoneOff className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-sm text-gray-600">Call failed</p>
              <p className="mt-1 text-xs text-gray-500">No answer or busy</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2">
          {call.state === 'connected' && !call.isTakenOver && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleListen}
                className={`flex-1 h-8 text-xs ${
                  call.isListening
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                {call.isListening ? 'Listening' : 'Listen'}
              </Button>
              <Button
                size="sm"
                onClick={handleTakeOver}
                className="flex-1 h-8 text-xs bg-black text-white hover:bg-gray-900"
              >
                <Hand className="mr-1.5 h-3.5 w-3.5" />
                Take Over
              </Button>
            </>
          )}

          {call.isTakenOver && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-gray-900 bg-gray-900 text-white"
              >
                <Mic className="mr-1.5 h-3.5 w-3.5" />
                You're Live
              </Button>
              <Button
                size="sm"
                onClick={handleTakeOver}
                className="flex-1 h-8 text-xs border border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Resume AI
              </Button>
            </>
          )}

          {(call.state === 'connected' || call.state === 'ringing') && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEndCall}
              className="h-8 px-3 border-gray-300 text-gray-600 hover:border-gray-400"
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </Button>
          )}

          {(call.state === 'completed' || call.state === 'voicemail' || call.state === 'failed') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/summaries')}
                className="flex-1 h-8 text-xs border-gray-300 text-gray-600 hover:border-gray-400"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Summaries
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
