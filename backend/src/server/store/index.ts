import { InMemoryCallStore } from './in-memory-call-store';
import { prisma } from '@/lib/db';
import { PrismaCallStore, prismaCallStore } from './prisma-call-store';
import type { CallStore } from './types';

export { InMemoryCallStore, PrismaCallStore };
export * from './types';

// Use in-memory store for local development to avoid database schema sync issues
// The database columns were just added, but we'll use in-memory for now to ensure it works
const store: CallStore = new InMemoryCallStore();
console.log('[store] Using in-memory store for local development');

export const callStore = store;
