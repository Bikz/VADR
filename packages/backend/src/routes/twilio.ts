import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import { VoiceResponse } from '../lib/twilio.js';
import type Twilio from 'twilio';
import { env, resolvePublicBaseUrl } from '../lib/env.js';
import { callService } from '../server/services/call-service.js';
import type { GatherAttributes, SayAttributes } from 'twilio/lib/twiml/VoiceResponse';
import { callAudioBroker } from '../server/services/audio-broker.js';

const MAX_CONVERSATION_TURNS = 10;
const MIN_SPEECH_CONFIDENCE = 0.2;
const CHARS_PER_SECOND = 15;
const BASE_SPEECH_TIMEOUT = 5;
const FALLBACK_TIMEOUT = 3;

function parseFormBody(body: unknown): Record<string, string> {
  if (!body) {
    return {};
  }

  if (typeof body === 'string') {
    const params = new URLSearchParams(body);
    const entries: Record<string, string> = {};
    params.forEach((value, key) => {
      entries[key] = value;
    });
    return entries;
  }

  if (body instanceof URLSearchParams) {
    const entries: Record<string, string> = {};
    body.forEach((value, key) => {
      entries[key] = value;
    });
    return entries;
  }

  if (Buffer.isBuffer(body)) {
    return parseFormBody(body.toString('utf8'));
  }

  if (typeof body === 'object') {
    const entries: Record<string, string> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        entries[key] = value[0] ? String(value[0]) : '';
      } else if (value === undefined || value === null) {
        entries[key] = '';
      } else {
        entries[key] = String(value);
      }
    }
    return entries;
  }

  return {};
}

function estimateTTSDuration(text: string): number {
  const chars = text.length;
  return Math.ceil(chars / CHARS_PER_SECOND);
}

function calculateSpeechTimeout(ttsText: string): number {
  const ttsDuration = estimateTTSDuration(ttsText);
  return BASE_SPEECH_TIMEOUT + ttsDuration;
}

function toWebsocketUrl(baseUrl: string) {
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  return baseUrl;
}

function attachStreaming(response: Twilio.twiml.VoiceResponse, streamUrl: string, callId: string) {
  const start = response.start();
  start.stream({
    url: streamUrl,
    track: 'both_tracks',
    name: callId,
  });
}

function buildLoopingResponse(
  runId: string,
  callId: string,
  replyText: string,
  voice: string | null,
  gatherUrl: string,
  options?: { speakResponse?: boolean }
) {
  const response = new VoiceResponse();

  const baseUrl = resolvePublicBaseUrl();
  const streamUrl = `${toWebsocketUrl(baseUrl)}/api/twilio/stream?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;
  attachStreaming(response, streamUrl, callId);

  const speechTimeout = calculateSpeechTimeout(replyText);
  const speakResponse = options?.speakResponse ?? true;
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

  if (speakResponse) {
    if (voice) {
      const sayVoice = voice as SayAttributes['voice'];
      gather.say({ voice: sayVoice }, replyText);
      response.say({ voice: sayVoice }, 'I did not catch that. Let me try again.');
    } else {
      gather.say(replyText);
      response.say('I did not catch that. Let me try again.');
    }
  }

  response.redirect(gatherUrl);

  console.log('[gather] responding with agent turn', {
    runId,
    callId,
    replyText,
    speechTimeout,
    speakResponse,
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
  const streamUrl = `${toWebsocketUrl(baseUrl)}/api/twilio/stream?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;

  const response = new VoiceResponse();
  attachStreaming(response, streamUrl, callId);
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
    ? `Hi, this is Tara calling! I wanted to ask you a quick question about your business. Do you have a moment?`
    : 'Hi, this is Tara calling with a quick question. Do you have a moment?';

  if (voice) {
    const sayVoice = voice as SayAttributes['voice'];
    gather.say({ voice: sayVoice }, openingLine);
    response.say({ voice: sayVoice }, 'I did not catch that. Let me try again.');
  } else {
    gather.say(openingLine);
    response.say('I did not catch that. Let me try again.');
  }

  await callService.recordAgentPrompt(callId, openingLine);
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

    const form = parseFormBody(request.body);
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

      const { replyText, shouldTerminate, allowAgentSpeech } = await callService.handleGather({
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

      const response = buildLoopingResponse(runId, callId, replyText, voice, gatherUrl, {
        speakResponse: allowAgentSpeech,
      });
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

  // GET /api/twilio/gather - Twilio validation (redirect to POST)
  fastify.get('/gather', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    // For GET requests, return a simple redirect TwiML to the POST endpoint
    const response = new VoiceResponse();
    const baseUrl = resolvePublicBaseUrl();
    const gatherUrl = `${baseUrl}/api/twilio/gather?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;
    response.redirect({ method: 'POST' }, gatherUrl);

    return reply.type('text/xml').send(response.toString());
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

  fastify.post('/outbound', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    const response = await buildGatherResponse(runId, callId);
    return reply.type('text/xml').send(response.toString());
  });

  fastify.get('/stream', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    const { callId, runId } = request.query as { callId?: string; runId?: string };

    if (!callId || !runId) {
      socket.close(1008, 'Missing identifiers');
      return;
    }

    console.log('[twilio-stream] connected', { callId, runId });

    socket.on('message', (payload) => {
      callAudioBroker.handleTwilioPayload(callId, payload);
    });

    socket.on('close', () => {
      console.log('[twilio-stream] disconnected', { callId, runId });
    });
  });

  // POST /api/twilio/status - Handle status callback
  fastify.post('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    const form = parseFormBody(request.body);
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

  // POST /api/twilio/recording-status - Handle recording status callback
  fastify.post('/recording-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { runId, callId } = request.query as { runId?: string; callId?: string };

    if (!runId || !callId) {
      return reply.code(400).send('Missing identifiers');
    }

    const form = parseFormBody(request.body);
    const recordingUrl = form.RecordingUrl;
    const recordingSid = form.RecordingSid;
    const recordingStatus = form.RecordingStatus;
    const recordingDuration = form.RecordingDuration;

    console.log('[recording] received callback', {
      runId,
      callId,
      recordingSid,
      recordingStatus,
      recordingDuration,
      recordingUrl,
    });

    // Store the recording URL in your database if needed
    // For now, just log it - you can extend this to save to the call record

    return reply.code(200).send('OK');
  });

  // GET for validation
  fastify.get('/recording-status', async (request, reply) => {
    return reply.code(200).send('OK');
  });
}
