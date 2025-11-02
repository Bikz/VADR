import { NextRequest } from 'next/server';
import { VoiceResponse } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { callService } from '@/server/services/call-service';
import type { GatherAttributes, SayAttributes } from 'twilio/lib/twiml/VoiceResponse';

function parseFormBody(body: string) {
  const params = new URLSearchParams(body);
  const entries: Record<string, string> = {};
  params.forEach((value, key) => {
    entries[key] = value;
  });
  return entries;
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
  const callSid = form.CallSid;
  const voice = env.twilioVoiceName();
  const baseUrl = resolvePublicBaseUrl();
  const gatherUrl = `${baseUrl}/api/twilio/gather?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;

  try {
    const { replyText } = await callService.handleGather({
      runId,
      callId,
      speechResult,
      callSid,
    });

    const response = new VoiceResponse();
    const gatherOptions: GatherAttributes = {
      input: ['speech'],
      speechTimeout: 'auto',
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
    console.error('Failed to handle gather', error);
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
