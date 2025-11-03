import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import formbody from '@fastify/formbody';
import { twilioRoutes } from './routes/twilio.js';
import { callRoutes } from './routes/calls.js';
import { searchRoutes } from './routes/search.js';
import { eventRoutes } from './routes/events.js';
import { audioRoutes } from './routes/audio.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: 'info', // Use info level in both dev and prod so we can see CORS logs
    // Only enable pretty logging if LOG_PRETTY=1 is explicitly set
    // Defaults to plain JSON (faster, production-safe, no extra deps needed)
    transport: process.env.LOG_PRETTY === '1' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

const rawOrigins = process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';
const allowedOrigins = rawOrigins
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// Add Vercel domains to allowed origins for preview deployments
const vercelDomains = [
  '*.vercel.app',
  '*.vercel.sh',
];

const matchesOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow server-to-server / same-origin
  
  // Always allow localhost in development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }
  
  // Extract hostname from origin URL
  let originHostname: string;
  try {
    originHostname = new URL(origin).hostname;
  } catch {
    // If origin is not a valid URL, try to parse it differently
    originHostname = origin.replace(/^https?:\/\//, '').split('/')[0];
  }
  
  // Check explicitly allowed origins
  const matchesExplicit = allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.startsWith('http')) {
      try {
        const allowedHostname = new URL(allowed).hostname;
        return originHostname === allowedHostname || origin === allowed;
      } catch {
        return origin === allowed;
      }
    }
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1); // remove leading *
      return originHostname.endsWith(suffix);
    }
    try {
      const regex = new RegExp(allowed);
      return regex.test(origin) || regex.test(originHostname);
    } catch {
      return false;
    }
  });
  
  if (matchesExplicit) return true;
  
  // Check Vercel domains - originHostname should end with .vercel.app or .vercel.sh
  const matchesVercel = vercelDomains.some((domain) => {
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1); // remove leading * to get .vercel.app
      return originHostname.endsWith(suffix);
    }
    return originHostname === domain;
  });
  
  return matchesVercel;
};

// Build the complete list of allowed origins for CORS
const buildAllowedOrigins = (): (string | RegExp)[] => {
  const origins: (string | RegExp)[] = [];
  
  // Add explicit allowed origins
  origins.push(...allowedOrigins);
  
  // Add Vercel domain patterns as regex
  origins.push(/^https:\/\/.*\.vercel\.app$/);
  origins.push(/^https:\/\/.*\.vercel\.sh$/);
  
  // Always allow localhost for development
  origins.push(/^http:\/\/localhost:\d+$/);
  origins.push(/^http:\/\/127\.0\.0\.1:\d+$/);
  
  return origins;
};

// Register CORS with explicit origin list (more reliable than callback)
await fastify.register(cors, {
  origin: buildAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
  preflight: true,
  strictPreflight: false,
});

// Add manual CORS logging via hook
fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (origin) {
    const isAllowed = matchesOrigin(origin);
    fastify.log.info({ 
      origin, 
      isAllowed, 
      path: request.url,
      method: request.method 
    }, 'CORS: request received');
  }
});

// Register form body parser for Twilio webhooks
await fastify.register(formbody);

await fastify.register(websocket);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// CORS test endpoint
fastify.get('/cors-test', async (request, reply) => {
  const origin = request.headers.origin;
  const hostname = origin ? (() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return 'invalid';
    }
  })() : 'no-origin';
  
  return {
    status: 'ok',
    origin,
    hostname,
    matchesOrigin: matchesOrigin(origin),
    allowedOrigins,
    vercelDomains,
    message: 'If you see this from the browser, CORS is working!',
  };
});

// Register routes
await fastify.register(twilioRoutes, { prefix: '/api/twilio' });
await fastify.register(callRoutes, { prefix: '/api' });
await fastify.register(searchRoutes, { prefix: '/api' });
await fastify.register(eventRoutes, { prefix: '/api' });
await fastify.register(audioRoutes, { prefix: '/api' });

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 VADR Backend server listening on ${HOST}:${PORT}`);
  console.log(`📍 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🌐 CORS configured for origins: ${allowedOrigins.join(', ') || 'none (using defaults + Vercel)'}`);
  console.log(`🌐 Vercel domains allowed: ${vercelDomains.join(', ')}`);
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
