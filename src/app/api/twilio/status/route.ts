import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
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
    console.error('[status-callback] failed to handle status', {
      runId,
      callId,
      error,
    });
    return new Response('Server error', { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

