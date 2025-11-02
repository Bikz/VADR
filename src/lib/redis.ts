import { Redis } from '@upstash/redis';

declare global {
  // eslint-disable-next-line no-var
  var __redis__: Redis | undefined;
}

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[redis] Upstash credentials missing – falling back to in-memory store.');
    }
    return null;
  }

  if (global.__redis__) {
    return global.__redis__;
  }

  const client = new Redis({ url, token });
  if (process.env.NODE_ENV !== 'production') {
    global.__redis__ = client;
  }
  return client;
}

export const redis = getRedis();

