import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { twilioRoutes } from './routes/twilio.js';
import { callRoutes } from './routes/calls.js';
import { searchRoutes } from './routes/search.js';
import { eventRoutes } from './routes/events.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

const rawOrigins = process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
const allowedOrigins = rawOrigins
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const matchesOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow server-to-server / same-origin
  return allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.startsWith('http')) {
      return origin === allowed;
    }
    if (allowed.startsWith('*.')) {
      const hostname = new URL(origin).hostname;
      const suffix = allowed.slice(1); // remove leading *
      return hostname.endsWith(suffix);
    }
    try {
      const regex = new RegExp(allowed);
      return regex.test(origin);
    } catch {
      return false;
    }
  });
};

// Register CORS
await fastify.register(cors, {
  origin: (origin, cb) => {
    if (matchesOrigin(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin ?? '<unknown>'} is not allowed by CORS`));
    }
  },
  credentials: true,
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(twilioRoutes, { prefix: '/api/twilio' });
await fastify.register(callRoutes, { prefix: '/api' });
await fastify.register(searchRoutes, { prefix: '/api' });
await fastify.register(eventRoutes, { prefix: '/api' });

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 VADR Backend server listening on ${HOST}:${PORT}`);
  console.log(`📍 Health check: http://${HOST}:${PORT}/health`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, closing server gracefully...`);
    await fastify.close();
    process.exit(0);
  });
});
