import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { callService } from '../server/services/call-service.js';

export async function eventRoutes(fastify: FastifyInstance) {
  // GET /api/events - Server-Sent Events stream for call updates
  fastify.get('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId } = request.query as { runId?: string };

    if (!runId) {
      return reply.code(400).send({ error: 'Missing runId' });
    }

    // Set up SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    let active = true;
    let lastSignature: string | null = null;

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (active) {
        reply.raw.write(': ping\n\n');
      }
    }, 15000);

    // Polling function
    const poll = async () => {
      if (!active) return;

      try {
        const session = await callService.getRun(runId);
        if (session) {
          const snapshot = {
            type: 'snapshot' as const,
            run: session.run,
          };

          const signature = JSON.stringify(snapshot.run);
          if (signature !== lastSignature) {
            lastSignature = signature;
            reply.raw.write(`data: ${JSON.stringify(snapshot)}\n\n`);
          }
        }
      } catch (error) {
        console.error('[events] failed to poll run', error);
      } finally {
        if (active) {
          setTimeout(poll, 3000);
        }
      }
    };

    // Start polling
    void poll();

    // Cleanup on connection close
    request.raw.on('close', () => {
      active = false;
      clearInterval(heartbeat);
      console.log(`[events] client disconnected from runId ${runId}`);
    });

    // Don't call reply.send() - we're streaming
    return reply;
  });
}
