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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      const errorMessage = payload?.error ?? `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    return payload as T;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Cannot connect to backend server at ${BACKEND_URL}. Make sure the backend is running.`);
    }
    throw error;
  }
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  try {
    const url = new URL(`${BACKEND_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
    }
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      const errorMessage = payload?.error ?? `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }
    
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    return payload as T;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Cannot connect to backend server at ${BACKEND_URL}. Make sure the backend is running.`);
    }
    throw error;
  }
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

  parseEvent(data: string): CallEvent | null {
    if (!data) return null;
    const parsed = callEventSchema.safeParse(JSON.parse(data));
    if (!parsed.success) return null;
    return parsed.data;
  },

  async simulateConversation(runId: string, callId: string, autoSimulate = true): Promise<{
    vendorResponse?: string;
    taraResponse?: string;
    shouldTerminate: boolean;
  }> {
    const raw = await request<unknown>('/api/demo/simulate-conversation', {
      method: 'POST',
      body: JSON.stringify({ runId, callId, autoSimulate }),
    });

    return raw as {
      vendorResponse?: string;
      taraResponse?: string;
      shouldTerminate: boolean;
    };
  },

  async simulateVendorResponse(
    runId: string,
    callId: string,
    conversation: Array<{ role: 'system' | 'assistant' | 'user'; content: string }>,
    lastTaraMessage: string,
    objective: string
  ): Promise<{ text: string }> {
    const raw = await request<unknown>('/api/demo/simulate-vendor', {
      method: 'POST',
      body: JSON.stringify({
        runId,
        callId,
        conversation,
        lastTaraMessage,
        objective,
      }),
    });

    return raw as { text: string };
  },

  async sendUserVendorResponse(
    runId: string,
    callId: string,
    userTranscript: string
  ): Promise<{ taraResponse: string; shouldTerminate: boolean }> {
    const raw = await request<unknown>('/api/demo/user-vendor-response', {
      method: 'POST',
      body: JSON.stringify({
        runId,
        callId,
        userTranscript,
      }),
    });

    return raw as { taraResponse: string; shouldTerminate: boolean };
  },
};
