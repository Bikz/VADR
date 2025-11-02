import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export function getPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[prisma] DATABASE_URL not set – persistence disabled.');
    }
    return null;
  }

  if (global.__prisma__) {
    return global.__prisma__;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    global.__prisma__ = client;
  }
  return client;
}

export const prisma = getPrisma();

