import { InMemoryCallStore } from './in-memory-call-store';
import { prisma } from '@/lib/db';
import { PrismaCallStore, prismaCallStore } from './prisma-call-store';
import type { CallStore } from './types';

export { InMemoryCallStore, PrismaCallStore };
export * from './types';

const store: CallStore = prismaCallStore ?? new InMemoryCallStore();

export const callStore = store;
