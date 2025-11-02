import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VoiceResponse } from '../lib/twilio.js';
import { env, resolvePublicBaseUrl } from '../lib/env.js';
import { callService } from '../server/services/call-service.js';
import type { GatherAttributes, SayAttributes } from 'twilio/lib/twiml/VoiceResponse';

const MAX_CONVERSATION_TURNS = 10;
const MIN_SPEECH_CONFIDENCE = 0.3;
const CHARS_PER_SECOND = 15;
const BASE_SPEECH_TIMEOUT = 5;
const FALLBACK_TIMEOUT = 3;

function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const entries: Record<string, string> = {};
  params.forEach((value, key) => {
    entries[key] = value;
  });
  return entries;
}

function estimateTTSDuration(text: string): number {
  const chars = text.length;
  return Math.ceil(chars / CHARS_PER_SECOND);
}

function calculateSpeechTimeout(ttsText: string): number {
  const ttsDuration = estimateTTSDuration(ttsText);
  return BASE_SPEECH_TIMEOUT + ttsDuration;
}

function buildLoopingResponse(
  runId: string,
  callId: string,
  replyText: string,
  voice: string | null,
  gatherUrl: string
) {
  const response = new VoiceResponse();

  const speechTimeout = calculateSpeechTimeout(replyText);
  const gatherOptions: GatherAttributes = {
    input: ['speech', 'dtmf'],
    speechTimeout: speechTimeout.toString(),
    timeout: speechTimeout + FALLBACK_TIMEOUT,
    numDigits: 1,
    speechModel: 'phone_call',
    enhanced: true,
    action: gatherUrl,
    method: 'POST',
  };

  const gather = response.gather(gatherOptions);

  if (voice) {
    const sayVoice = voice as SayAttributes['voice'];
    gather.say({ voice: sayVoice }, replyText);
    response.say({ voice: sayVoice }, 'I did not catch that. Let me try again.');
  } else {
    gather.say(replyText);
    response.say('I did not catch that. Let me try again.');
  }

  response.redirect(gatherUrl);

  console.log('[gather] responding with agent turn', {
    runId,
    callId,
    replyText,
    speechTimeout,
  });

  return response;
}

function buildTerminationResponse(message: string, voice: string | null) {
  const response = new VoiceResponse();
  if (voice) {
    const sayVoice = voice as SayAttributes['voice'];
    response.say({ voice: sayVoice }, message);
  } else {
    response.say(message);
  }
  response.hangup();
  return response;
}

async function buildGatherResponse(runId: string, callId: string) {
  const runSession = await callService.getRun(runId);
  const prep = runSession?.prep;
  const voice = env.twilioVoiceName();
  const baseUrl = resolvePublicBaseUrl();
  const gatherUrl = `${baseUrl}/api/twilio/gather?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;

  const response = new VoiceResponse();
  const gatherOptions: GatherAttributes = {
    input: ['speech', 'dtmf'],
    speechTimeout: '5',
    timeout: 8,
    speechModel: 'phone_call',
    enhanced: true,
    action: gatherUrl,
    method: 'POST',
  };

  const gather = response.gather(gatherOptions);

  const openingLine = prep
    ? `Hello, this is VADR calling about ${prep.objective}. Do you have a moment to chat?`
    : 'Hello, this is VADR, calling with a quick question. Do you have a moment?';

  if (voice) {
    const sayVoice = voice as SayAttributes['voice'];
    gather.say({ voice: sayVoice }, openingLine);
    response.say({ voice: sayVoice }, 'I did not catch that. Let me try again.');
  } else {
    gather.say(openingLine);
    response.say('I did not catch that. Let me try again.');
  }
  response.redirect(gatherUrl);

  return response;
}

export async function twilioRoutes(fastify: FastifyInstance) {
  // POST /api/twilio/gather - Handle gather webhook
  fastify.post('/gather', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    const rawBody = typeof request.body === 'string' ? request.body : '';
    const form = parseFormBody(rawBody);
    const speechResult = form.SpeechResult?.trim();
    const confidence = form.Confidence ? parseFloat(form.Confidence) : 1.0;
    const callSid = form.CallSid;
    const voice = env.twilioVoiceName();
    const baseUrl = resolvePublicBaseUrl();
    const gatherUrl = `${baseUrl}/api/twilio/gather?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;

    try {
      const conversationHistory = await callService.getConversationHistory(callId);
      const turnCount = Math.floor(conversationHistory.filter((turn) => turn.role !== 'system').length / 2);

      console.log('[gather] received webhook', {
        runId,
        callId,
        speechLength: speechResult?.length ?? 0,
        confidence,
        turnCount,
      });

      if (turnCount >= MAX_CONVERSATION_TURNS) {
        console.log('[gather] terminating due to max conversation length', {
          runId,
          callId,
          maxTurns: MAX_CONVERSATION_TURNS,
        });

        const terminationMessage = 'Thank you for your time today. Have a wonderful rest of your day!';
        const response = buildTerminationResponse(terminationMessage, voice);
        return reply.type('text/xml').send(response.toString());
      }

      let validSpeech: string | undefined = speechResult;
      if (speechResult && confidence < MIN_SPEECH_CONFIDENCE) {
        console.log('[gather] ignoring low confidence speech', {
          runId,
          callId,
          confidence,
          threshold: MIN_SPEECH_CONFIDENCE,
          speechResult,
        });
        validSpeech = undefined;
      } else if (speechResult) {
        console.log('[gather] accepted speech', {
          runId,
          callId,
          confidence,
          speechLength: speechResult.length,
        });
      } else {
        console.log('[gather] no speech detected', {
          runId,
          callId,
          formKeys: Object.keys(form),
        });
      }

      const { replyText, shouldTerminate } = await callService.handleGather({
        runId,
        callId,
        speechResult: validSpeech,
        callSid,
      });

      if (shouldTerminate) {
        console.log('[gather] agent requested termination', {
          runId,
          callId,
        });
        const response = buildTerminationResponse(replyText, voice);
        return reply.type('text/xml').send(response.toString());
      }

      const response = buildLoopingResponse(runId, callId, replyText, voice, gatherUrl);
      return reply.type('text/xml').send(response.toString());
    } catch (error) {
      console.error('[gather] error handling webhook', {
        runId,
        callId,
        error,
      });

      const fallback = buildTerminationResponse('We are experiencing technical difficulties. Goodbye.', voice);
      return reply.code(200).type('text/xml').send(fallback.toString());
    }
  });

  // GET /api/twilio/gather - Twilio validation
  fastify.get('/gather', async (request, reply) => {
    return fastify.inject({
      method: 'POST',
      url: request.url,
      payload: request.body,
    });
  });

  // GET/POST /api/twilio/outbound - Handle outbound call
  fastify.get('/outbound', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    const response = await buildGatherResponse(runId, callId);
    return reply.type('text/xml').send(response.toString());
  });

  fastify.post('/outbound', async (request, reply) => {
    return fastify.inject({
      method: 'GET',
      url: request.url,
    });
  });

  // POST /api/twilio/status - Handle status callback
  fastify.post('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    const rawBody = typeof request.body === 'string' ? request.body : '';
    const form = parseFormBody(rawBody);
    const callStatus = form.CallStatus;
    const answeredBy = form.AnsweredBy;
    const callSid = form.CallSid;
    const callDuration = form.CallDuration;

    console.log('[status] received callback', {
      runId,
      callId,
      callStatus,
      answeredBy,
      callSid,
      callDuration,
    });

    try {
      await callService.handleStatus({
        runId,
        callId,
        callStatus,
        answeredBy,
        callSid,
        callDuration,
      });

      return reply.code(200).send('OK');
    } catch (error) {
      console.error('[status] error handling callback', {
        runId,
        callId,
        error,
      });
      return reply.code(500).send('Error handling status');
    }
  });

  // GET for validation
  fastify.get('/status', async (request, reply) => {
    return reply.code(200).send('OK');
  });
}
