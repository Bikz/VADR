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

// Register CORS
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
