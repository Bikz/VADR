import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { textToSpeech } from '../lib/elevenlabs.js';

const ttsRequestSchema = z.object({
  text: z.string().min(1),
  voice_id: z.string().optional(),
  model_id: z.string().optional(),
  voice_settings: z.object({
    stability: z.number().optional(),
    similarity_boost: z.number().optional(),
    style: z.number().optional(),
    use_speaker_boost: z.boolean().optional(),
  }).optional(),
});

export async function elevenlabsRoutes(fastify: FastifyInstance) {
  // POST /api/elevenlabs/tts - Text to speech
  fastify.post('/elevenlabs/tts', async (request: FastifyRequest, reply: FastifyReply) => {
    let data;
    try {
      data = ttsRequestSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid payload', details: error });
    }

    try {
      const audioBuffer = await textToSpeech(data.text, {
        voiceId: data.voice_id,
        modelId: data.model_id,
        voiceSettings: data.voice_settings,
      });

      reply.type('audio/mpeg');
      return reply.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error('[elevenlabs] TTS failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to generate speech',
      });
    }
  });

  // GET /api/elevenlabs/voices - Get available voices (optional)
  fastify.get('/elevenlabs/voices', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return reply.code(500).send({ error: 'ELEVENLABS_API_KEY not configured' });
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return reply.send(data.voices || []);
    } catch (error) {
      console.error('[elevenlabs] failed to fetch voices', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to fetch voices',
      });
    }
  });
}

