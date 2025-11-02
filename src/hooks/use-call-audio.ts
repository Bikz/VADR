'use client';

import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { decodeMulaw } from '@/lib/audio';

const AUDIO_SAMPLE_RATE = 8000;

type AudioTrack = 'inbound' | 'outbound' | 'both';

interface AudioStreamMessage {
  event: 'start' | 'media' | 'stop';
  payload?: string;
  track?: AudioTrack;
  sequenceNumber?: number;
  timestamp?: number;
}

export function useCallAudio(callId: string, shouldPlay: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const scheduledTimesRef = useRef<Partial<Record<AudioTrack, number>>>({});

  useEffect(() => {
    if (!shouldPlay) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.suspend().catch(() => {});
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API is not supported in this browser.');
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    void context.resume().catch(() => {});
    scheduledTimesRef.current = {};

    const socket = apiClient.createWebSocket(`/api/calls/${encodeURIComponent(callId)}/audio`);
    socketRef.current = socket;

    socket.addEventListener('message', (event) => {
      try {
        const data: AudioStreamMessage = JSON.parse(event.data);
        if (data.event === 'media' && typeof data.payload === 'string') {
          const samples = decodeMulaw(data.payload);
          if (!samples) return;

          const buffer = context.createBuffer(1, samples.length, AUDIO_SAMPLE_RATE);
          const channelData = new Float32Array(samples.length);
          channelData.set(samples);
          buffer.copyToChannel(channelData, 0);

          const source = context.createBufferSource();
          source.buffer = buffer;

          const track: AudioTrack = data.track ?? 'inbound';
          const key = track;
          const scheduled = scheduledTimesRef.current[key] ?? context.currentTime;
          const startAt = Math.max(scheduled, context.currentTime);
          scheduledTimesRef.current[key] = startAt + buffer.duration;

          const stereoContext = context as AudioContext & {
            createStereoPanner?: () => StereoPannerNode;
          };
          const panNode = typeof stereoContext.createStereoPanner === 'function'
            ? stereoContext.createStereoPanner()
            : null;

          if (panNode) {
            if (track === 'inbound') {
              panNode.pan.value = -0.6;
            } else if (track === 'outbound') {
              panNode.pan.value = 0.6;
            } else {
              panNode.pan.value = 0;
            }
            source.connect(panNode);
            panNode.connect(context.destination);
          } else {
            source.connect(context.destination);
          }

          source.start(startAt);
        } else if (data.event === 'stop') {
          scheduledTimesRef.current = {};
        } else if (data.event === 'start') {
          scheduledTimesRef.current = {};
        }
      } catch (error) {
        console.error('Failed to process audio payload', error);
      }
    });

    socket.addEventListener('close', () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    });

    socket.addEventListener('error', () => {
      socket.close();
    });

    return () => {
      socket.close();
    };
  }, [callId, shouldPlay]);
}
