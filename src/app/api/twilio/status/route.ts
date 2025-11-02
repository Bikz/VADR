import { NextRequest } from 'next/server';
import { callService } from '@/server/services/call-service';

function parseForm(body: string) {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId');
  const callId = url.searchParams.get('callId');

  if (!runId || !callId) {
    return new Response('Missing identifiers', { status: 400 });
  }

  const body = await request.text();
  const form = parseForm(body);
  const callSid = form.CallSid;
  const callStatus = form.CallStatus ?? '';
  const answeredBy = form.AnsweredBy;
  const callDuration = form.CallDuration;

  try {
    await callService.handleStatus({
      runId,
      callId,
      callStatus,
      answeredBy,
      callSid,
      callDuration,
    });
  } catch (error) {
    console.error('Failed to handle status callback', error);
    return new Response('Server error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}
