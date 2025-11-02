/**
 * API Client for backend communication
 *
 * Uses NEXT_PUBLIC_BACKEND_URL environment variable to determine backend location.
 * Falls back to localhost:3001 for local development.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const apiClient = {
  /**
   * Get the backend base URL
   */
  getBaseUrl(): string {
    return BACKEND_URL;
  },

  /**
   * Make a POST request to the backend
   */
  async post<T = any>(path: string, data: any): Promise<T> {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  /**
   * Make a GET request to the backend
   */
  async get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BACKEND_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  /**
   * Create an EventSource for SSE streaming
   */
  createEventSource(path: string, params?: Record<string, string>): EventSource {
    const url = new URL(`${BACKEND_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    return new EventSource(url.toString());
  },
};
