import { z } from 'zod';
import {
  callActionSchema,
  CallActionRequest,
  callEventSchema,
  leadSchema,
  Lead,
  startCallsRequestSchema,
  startCallsResponseSchema,
  StartCallsRequest,
  StartCallsResponse,
  CallEvent,
} from '@vadr/shared';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function toWebsocketUrl(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  return baseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage = payload?.error ?? `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BACKEND_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
  }
  const response = await fetch(url.toString());
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage = payload?.error ?? `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

export type SearchLeadsParams = {
  query: string;
  lat: number;
  lng: number;
};

export const apiClient = {
  getBaseUrl(): string {
    return BACKEND_URL;
  },

  async searchLeads(params: SearchLeadsParams): Promise<Lead[]> {
    const { query, lat, lng } = params;

    const raw = await getJson<unknown>('/api/search', {
      q: query,
      lat: lat.toString(),
      lng: lng.toString(),
    });

    const parsed = z.array(leadSchema).parse(raw);
    return parsed;
  },

  async startCallRun(payload: StartCallsRequest): Promise<StartCallsResponse> {
    const validated = startCallsRequestSchema.parse(payload);
    const raw = await request<unknown>('/api/start-calls', {
      method: 'POST',
      body: JSON.stringify(validated),
    });

    return startCallsResponseSchema.parse(raw);
  },

  async updateCall(callId: string, action: CallActionRequest): Promise<void> {
    const validated = callActionSchema.parse(action);
    await request(`/api/calls/${encodeURIComponent(callId)}`, {
      method: 'POST',
      body: JSON.stringify(validated),
    });
  },

  createEventSource(path: string, params?: Record<string, string>): EventSource {
    const url = new URL(`${BACKEND_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    return new EventSource(url.toString());
  },

  createWebSocket(path: string, params?: Record<string, string>): WebSocket {
    const wsBase = toWebsocketUrl(BACKEND_URL);
    const url = new URL(`${wsBase}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    return new WebSocket(url.toString());
  },

  parseEvent(data: string): CallEvent | null {
    if (!data) return null;
    const parsed = callEventSchema.safeParse(JSON.parse(data));
    if (!parsed.success) return null;
    return parsed.data;
  },
};
