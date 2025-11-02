import type { WebSocket, RawData } from 'ws';

interface TwilioStreamMessage {
  event: 'start' | 'media' | 'stop' | string;
  start?: {
    streamSid: string;
  };
  media?: {
    payload: string;
    track?: string;
    timestamp?: string;
    sequenceNumber?: string;
  };
  stop?: Record<string, unknown>;
}

type ListenerTrack = 'inbound' | 'outbound' | 'both';

interface ListenerPayload {
  event: 'start' | 'media' | 'stop';
  payload?: string;
  streamSid?: string;
  timestamp?: number;
  track?: ListenerTrack;
  sequenceNumber?: number;
}

function normalizeTrack(track: string | undefined): ListenerTrack | undefined {
  switch (track) {
    case 'inbound_track':
      return 'inbound';
    case 'outbound_track':
      return 'outbound';
    case 'both_tracks':
      return 'both';
    default:
      return undefined;
  }
}

export class CallAudioBroker {
  private listeners = new Map<string, Set<WebSocket>>();

  registerListener(callId: string, socket: WebSocket): void {
    const peers = this.listeners.get(callId) ?? new Set<WebSocket>();
    peers.add(socket);
    this.listeners.set(callId, peers);

    socket.on('close', () => {
      peers.delete(socket);
      if (peers.size === 0) {
        this.listeners.delete(callId);
      }
    });
  }

  handleTwilioPayload(callId: string, raw: RawData): void {
    let parsed: TwilioStreamMessage;
    try {
      parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    } catch (error) {
      console.error('[audio-broker] failed to parse Twilio stream payload', {
        callId,
        error,
      });
      return;
    }

    switch (parsed.event) {
      case 'start':
        this.broadcast(callId, {
          event: 'start',
          streamSid: parsed.start?.streamSid,
          timestamp: Date.now(),
        });
        break;
      case 'media':
        if (parsed.media?.payload) {
          this.broadcast(callId, {
            event: 'media',
            payload: parsed.media.payload,
            timestamp: Date.now(),
            track: normalizeTrack(parsed.media?.track),
            sequenceNumber: parsed.media?.sequenceNumber
              ? Number.parseInt(parsed.media.sequenceNumber, 10)
              : undefined,
          });
        }
        break;
      case 'stop':
        this.broadcast(callId, {
          event: 'stop',
          timestamp: Date.now(),
        });
        break;
      default:
        break;
    }
  }

  private broadcast(callId: string, payload: ListenerPayload): void {
    const peers = this.listeners.get(callId);
    if (!peers || peers.size === 0) {
      return;
    }

    const message = JSON.stringify(payload);
    for (const socket of [...peers]) {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      } else {
        peers.delete(socket);
      }
    }

    if (peers.size === 0) {
      this.listeners.delete(callId);
    }
  }
}

export const callAudioBroker = new CallAudioBroker();
