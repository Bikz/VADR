import { InMemoryCallStore } from './in-memory-call-store';
import { PrismaCallStore, prismaCallStore } from './prisma-call-store';
import type { CallStore } from './types';

export { InMemoryCallStore, PrismaCallStore };
export * from './types';

// Temporarily use in-memory store to bypass PostgreSQL cached plan issue
// TODO: Switch back to Prisma once Neon pooler cache clears or we use direct connection
const store: CallStore = new InMemoryCallStore();

if (store instanceof InMemoryCallStore) {
  console.warn('[store] WARNING: Using in-memory store. Data will not persist. Check DATABASE_URL.');
} else {
  console.log('[store] Using PrismaCallStore. Data will persist.');
}

export const callStore = store;
