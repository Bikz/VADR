import { NextRequest } from 'next/server';
import { VoiceResponse } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { callService } from '@/server/services/call-service';
import type { GatherAttributes, SayAttributes } from 'twilio/lib/twiml/VoiceResponse';

const MAX_CONVERSATION_TURNS = 10;
const MIN_SPEECH_CONFIDENCE = 0.5;
const CHARS_PER_SECOND = 15;
const BASE_SPEECH_TIMEOUT = 3;
const FALLBACK_TIMEOUT = 2;

function parseFormBody(body: string) {
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

async function buildLoopingResponse(
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

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId');
  const callId = url.searchParams.get('callId');

  if (!runId || !callId) {
    return new Response('Missing identifiers', { status: 400 });
  }

  const rawBody = await request.text();
  const form = parseFormBody(rawBody);
  const speechResult = form.SpeechResult?.trim();
  const confidence = form.Confidence ? Number.parseFloat(form.Confidence) : 1.0;
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
      return new Response(response.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    let validSpeech: string | undefined = speechResult;
    if (speechResult && confidence < MIN_SPEECH_CONFIDENCE) {
      console.log('[gather] ignoring low confidence speech', {
        runId,
        callId,
        confidence,
        threshold: MIN_SPEECH_CONFIDENCE,
      });
      validSpeech = undefined;
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
      return new Response(response.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const response = await buildLoopingResponse(runId, callId, replyText, voice, gatherUrl);
    return new Response(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[gather] error handling webhook', {
      runId,
      callId,
      error,
    });

    const fallback = buildTerminationResponse('We are experiencing technical difficulties. Goodbye.', voice);
    return new Response(fallback.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

export async function GET(request: NextRequest) {
  // Some Twilio validations may issue GET requests; reuse POST handler for simplicity.
  return POST(request);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
