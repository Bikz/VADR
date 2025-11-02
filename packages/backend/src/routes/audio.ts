import { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { callAudioBroker } from '../server/services/audio-broker.js';

export async function audioRoutes(fastify: FastifyInstance) {
  fastify.get('/calls/:callId/audio', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    const { callId } = request.params as { callId?: string };

    if (!callId) {
      socket.close(1008, 'Missing call identifier');
      return;
    }

    callAudioBroker.registerListener(callId, socket);

    socket.send(
      JSON.stringify({
        event: 'start',
        timestamp: Date.now(),
      })
    );
  });
}
