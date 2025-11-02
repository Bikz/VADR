import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { callAudioBroker } from '../server/services/audio-broker.js';

export async function audioRoutes(fastify: FastifyInstance) {
  fastify.get('/calls/:callId/audio', { websocket: true }, (connection: SocketStream, request) => {
    const { callId } = request.params as { callId?: string };

    if (!callId) {
      connection.socket.close(1008, 'Missing call identifier');
      return;
    }

    callAudioBroker.registerListener(callId, connection.socket);

    connection.socket.send(
      JSON.stringify({
        event: 'start',
        timestamp: Date.now(),
      })
    );
  });
}
