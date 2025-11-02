import { InMemoryCallStore } from './in-memory-call-store';

export { InMemoryCallStore };
export * from './types';

export const callStore = new InMemoryCallStore();

