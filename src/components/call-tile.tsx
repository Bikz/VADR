'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Hand, Play, Pause } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Call } from '@/types';
import { getStateColor, getSentimentColor } from '@/lib/mock-data';
import { Waveform } from './waveform';

interface CallTileProps {
  call: Call;
  onUpdate: (updates: Partial<Call>) => void;
}

export function CallTile({ call, onUpdate }: CallTileProps) {
  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (call.state === 'connected' || call.state === 'ringing') {
      const interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [call.state]);

  useEffect(() => {
    // Auto-scroll to bottom when new transcript arrives
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
    onUpdate({ isTakenOver: !call.isTakenOver });
  };

  const handleListen = () => {
    onUpdate({ isListening: !call.isListening });
  };

  const handleEndCall = () => {
    onUpdate({ state: 'completed' });
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {call.lead.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono">{call.lead.phone}</p>
          </div>
          <Badge
            variant="outline"
            className={`${getStateColor(call.state)} border capitalize text-xs shrink-0`}
          >
            {call.state}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Phone className="w-3.5 h-3.5" />
            <span className="font-mono">{formatDuration(duration)}</span>
          </div>
          {call.state === 'connected' && (
            <Badge variant="outline" className={`${getSentimentColor(call.sentiment)} text-xs`}>
              {call.sentiment}
            </Badge>
          )}
          <div className="flex-1" />
          <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
            {call.lead.source}
          </Badge>
        </div>

        {/* Waveform */}
        {(call.state === 'connected' || call.state === 'ringing') && (
          <Waveform isActive={call.state === 'connected'} isTakenOver={call.isTakenOver} />
        )}
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {call.transcript.length === 0 && call.state !== 'completed' && (
            <p className="text-xs text-slate-500 text-center py-8">
              {call.state === 'dialing' && 'Dialing...'}
              {call.state === 'ringing' && 'Ringing...'}
              {call.state === 'voicemail' && 'Voicemail detected'}
              {call.state === 'idle' && 'Waiting...'}
            </p>
          )}

          {call.transcript.map((turn) => (
            <div key={turn.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  turn.speaker === 'ai' ? 'text-[#6C5CE7]' : 'text-emerald-400'
                }`}>
                  {turn.speaker === 'ai' ? 'VADR' : call.lead.name.split(' ')[0]}
                </span>
              </div>
              <p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-2.5 font-mono leading-relaxed">
                {turn.text}
              </p>
            </div>
          ))}

          {call.state === 'completed' && call.transcript.length > 0 && (
            <div className="pt-4 border-t border-slate-800 mt-4">
              <p className="text-xs font-medium text-slate-400 mb-2">Extracted Data</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="text-slate-300">{formatDuration(duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Turns:</span>
                  <span className="text-slate-300">{call.transcript.length}</span>
                </div>
              </div>
            </div>
          )}

          {call.state === 'voicemail' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 mb-3">
                <MicOff className="w-6 h-6 text-orange-400" />
              </div>
              <p className="text-sm text-slate-400">Voicemail detected</p>
              <p className="text-xs text-slate-500 mt-1">Left automated message</p>
            </div>
          )}

          {call.state === 'failed' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-3">
                <PhoneOff className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-sm text-slate-400">Call failed</p>
              <p className="text-xs text-slate-500 mt-1">No answer or busy</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Controls */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2">
          {call.state === 'connected' && !call.isTakenOver && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleListen}
                className={`flex-1 h-8 text-xs ${
                  call.isListening
                    ? 'bg-[#6C5CE7]/20 border-[#6C5CE7] text-[#6C5CE7]'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                {call.isListening ? 'Listening' : 'Listen'}
              </Button>
              <Button
                size="sm"
                onClick={handleTakeOver}
                className="flex-1 h-8 text-xs bg-[#6C5CE7] hover:bg-[#5849c4]"
              >
                <Hand className="w-3.5 h-3.5 mr-1.5" />
                Take Over
              </Button>
            </>
          )}

          {call.isTakenOver && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-slate-700 text-slate-300"
              >
                <Mic className="w-3.5 h-3.5 mr-1.5" />
                You're Live
              </Button>
              <Button
                size="sm"
                onClick={handleTakeOver}
                className="flex-1 h-8 text-xs bg-orange-600 hover:bg-orange-700"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Resume AI
              </Button>
            </>
          )}

          {(call.state === 'connected' || call.state === 'ringing') && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEndCall}
              className="h-8 px-3 border-red-900/50 text-red-400 hover:bg-red-950/50"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </Button>
          )}

          {(call.state === 'completed' || call.state === 'voicemail' || call.state === 'failed') && (
            <p className="text-xs text-slate-500 text-center flex-1">
              Call ended
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
