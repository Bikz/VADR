import { InMemoryCallStore } from './in-memory-call-store';
import { prisma } from '@/lib/db';
import { PrismaCallStore, prismaCallStore } from './prisma-call-store';
import type { CallStore } from './types';

export { InMemoryCallStore, PrismaCallStore };
export * from './types';

// Select Prisma store when available, fall back to in-memory for resilience during setup
const store: CallStore = prismaCallStore ?? new InMemoryCallStore();

if (store instanceof InMemoryCallStore) {
  console.warn('[store] WARNING: Using in-memory store. Data will not persist. Check DATABASE_URL.');
} else {
  console.log('[store] Using PrismaCallStore. Data will persist.');
}

export const callStore = store;
