import { NextRequest } from 'next/server';
import { VoiceResponse } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { callService } from '@/server/services/call-service';
import type { GatherAttributes, SayAttributes } from 'twilio/lib/twiml/VoiceResponse';

// Configuration
const MAX_CONVERSATION_TURNS = 10; // Max exchanges (human + AI pairs)
const MIN_SPEECH_CONFIDENCE = 0.5; // Minimum confidence for speech recognition
const CHARS_PER_SECOND = 15; // Average speaking rate for TTS
const BASE_SPEECH_TIMEOUT = 3; // Base timeout in seconds
const FALLBACK_TIMEOUT = 2; // Additional seconds if speech not recognized

function parseFormBody(body: string) {
  const params = new URLSearchParams(body);
  const entries: Record<string, string> = {};
  params.forEach((value, key) => {
    entries[key] = value;
  });
  return entries;
}

/**
 * Estimates TTS duration based on text length
 * Uses average speaking rate to calculate realistic playback time
 */
function estimateTTSDuration(text: string): number {
  const chars = text.length;
  return Math.ceil(chars / CHARS_PER_SECOND);
}

/**
 * Calculates appropriate speech timeout accounting for TTS playback
 */
function calculateSpeechTimeout(ttsText: string): number {
  const ttsDuration = estimateTTSDuration(ttsText);
  // Give user time to hear the message plus time to respond
  return BASE_SPEECH_TIMEOUT + ttsDuration;
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
  const confidence = form.Confidence ? parseFloat(form.Confidence) : 1.0;
  const callSid = form.CallSid;
  const voice = env.twilioVoiceName();
  const baseUrl = resolvePublicBaseUrl();
  const gatherUrl = `${baseUrl}/api/twilio/gather?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;

  try {
    // Check conversation length before processing
    const conversationHistory = await callService.getConversationHistory(callId);
    const turnCount = Math.floor(conversationHistory.length / 2); // Each turn = human + AI

    console.log('[gather] processing speech', {
      runId,
      callId,
      turnCount,
      maxTurns: MAX_CONVERSATION_TURNS,
      speechLength: speechResult?.length ?? 0,
      confidence,
    });

    // Terminate if max turns reached
    if (turnCount >= MAX_CONVERSATION_TURNS) {
      console.log('[gather] max turns reached, terminating call', {
        runId,
        callId,
        turnCount,
      });

      const response = new VoiceResponse();
      const goodbyeMessage = 'Thank you so much for your time today. This has been very helpful. Have a great day!';

      if (voice) {
        const sayVoice = voice as SayAttributes['voice'];
        response.say({ voice: sayVoice }, goodbyeMessage);
      } else {
        response.say(goodbyeMessage);
      }
      response.hangup();

      return new Response(response.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Filter low confidence speech
    let validSpeech = speechResult;
    if (speechResult && confidence < MIN_SPEECH_CONFIDENCE) {
      console.log('[gather] low confidence speech ignored', {
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

    const response = new VoiceResponse();

    // Terminate if agent signals completion
    if (shouldTerminate) {
      console.log('[gather] agent requested termination', {
        runId,
        callId,
      });

      if (voice) {
        const sayVoice = voice as SayAttributes['voice'];
        response.say({ voice: sayVoice }, replyText);
      } else {
        response.say(replyText);
      }
      response.hangup();

      return new Response(response.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Calculate speech timeout based on reply length
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

    return new Response(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[gather] failed to handle gather', error);
    const response = new VoiceResponse();
    if (voice) {
      const sayVoice = voice as SayAttributes['voice'];
      response.say({ voice: sayVoice }, 'Sorry, we had an application error. Goodbye.');
    } else {
      response.say('Sorry, we had an application error. Goodbye.');
    }
    response.hangup();
    return new Response(response.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
