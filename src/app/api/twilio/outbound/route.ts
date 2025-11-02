import { NextRequest } from 'next/server';
import { VoiceResponse } from '@/lib/twilio';
import { env, resolvePublicBaseUrl } from '@/lib/env';
import { callService } from '@/server/services/call-service';
import type { GatherAttributes, SayAttributes } from 'twilio/lib/twiml/VoiceResponse';

function buildGatherResponse(runId: string, callId: string) {
  const prep = callService.getRun(runId)?.prep;
  const voice = env.twilioVoiceName();
  const baseUrl = resolvePublicBaseUrl();
  const gatherUrl = `${baseUrl}/api/twilio/gather?runId=${encodeURIComponent(runId)}&callId=${encodeURIComponent(callId)}`;

  const response = new VoiceResponse();
  const gatherOptions: GatherAttributes = {
    input: ['speech'],
    speechTimeout: 'auto',
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const callId = searchParams.get('callId');

  if (!runId || !callId) {
    return new Response('Missing identifiers', { status: 400 });
  }

  const response = buildGatherResponse(runId, callId);
  return new Response(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
