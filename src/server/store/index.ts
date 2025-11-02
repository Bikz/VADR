import { redis } from '@/lib/redis';
import { InMemoryCallStore } from './in-memory-call-store';
import { RedisCallStore } from './redis-call-store';
import type { CallStore } from './types';

export { InMemoryCallStore, RedisCallStore };
export * from './types';

const store: CallStore = redis ? new RedisCallStore(redis) : new InMemoryCallStore();

export const callStore = store;
