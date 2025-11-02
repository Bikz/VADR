import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CallPrep, Lead } from '../types/index.js';
import { callService } from '../server/services/call-service.js';

interface StartCallsRequest {
  runId?: string;
  query: string;
  leads: Lead[];
  prep: CallPrep;
  createdBy?: string;
}

interface CallActionRequest {
  action: 'listen' | 'takeover' | 'end';
  value?: boolean;
}

export async function callRoutes(fastify: FastifyInstance) {
  // POST /api/start-calls - Start a new call run
  fastify.post('/start-calls', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as StartCallsRequest;

    if (!data?.query || !Array.isArray(data.leads) || data.leads.length === 0) {
      return reply.code(400).send({ error: 'Invalid payload' });
    }

    const runId = data.runId ?? `run-${Date.now()}`;
    const createdBy = data.createdBy ?? 'vadr-user';

    try {
      console.log('[start-calls] starting run', {
        runId,
        createdBy,
        leadCount: data.leads.length,
        leads: data.leads.map((lead) => ({ id: lead.id, phone: lead.phone })),
      });

      const { run } = await callService.startRun({
        runId,
        query: data.query,
        leads: data.leads,
        prep: data.prep,
        createdBy,
      });

      return reply.send({
        runId,
        run,
      });
    } catch (error) {
      console.error('[start-calls] failed to start run', {
        runId,
        error,
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to start calls',
      });
    }
  });

  // POST /api/calls/:callId - Perform action on a call
  fastify.post('/calls/:callId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { callId } = request.params as { callId: string };
    const { action, value } = request.body as CallActionRequest;

    if (!callId) {
      return reply.code(400).send({ error: 'Missing call ID' });
    }

    if (!action) {
      return reply.code(400).send({ error: 'Missing action' });
    }

    try {
      switch (action) {
        case 'listen':
          await callService.setListening(callId, value ?? true);
          return reply.send({ success: true });

        case 'takeover':
          await callService.setTakeOver(callId, value ?? true);
          return reply.send({ success: true });

        case 'end':
          await callService.endCall(callId);
          return reply.send({ success: true });

        default:
          return reply.code(400).send({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error(`[calls] failed to perform action ${action} on call ${callId}`, {
        callId,
        action,
        error,
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to perform action',
      });
    }
  });

  // GET /api/calls/:callId - Get call details
  fastify.get('/calls/:callId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { callId } = request.params as { callId: string };

    if (!callId) {
      return reply.code(400).send({ error: 'Missing call ID' });
    }

    try {
      const callSession = await callService.getCall(callId);

      if (!callSession) {
        return reply.code(404).send({ error: 'Call not found' });
      }

      return reply.send(callSession.call);
    } catch (error) {
      console.error(`[calls] failed to get call ${callId}`, {
        callId,
        error,
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to get call',
      });
    }
  });
}
