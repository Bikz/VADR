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
  return vercelDomains.some((domain) => {
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1); // remove leading * to get .vercel.app
      return originHostname.endsWith(suffix);
    }
    return originHostname === domain;
  });
};

// Register CORS with function-based origin checking
await fastify.register(cors, {
  origin: (origin, callback) => {
    // Handle requests with no origin (server-to-server, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check if origin is allowed
    if (matchesOrigin(origin)) {
      fastify.log.debug({ origin }, 'CORS: allowing origin');
      // Return the specific origin to set Access-Control-Allow-Origin header
      callback(null, origin);
    } else {
      fastify.log.warn({ origin }, 'CORS: blocking origin');
      // Return false to deny the origin
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
  preflight: true, // Explicitly enable preflight handling
  strictPreflight: false, // Don't require preflight for all requests
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
