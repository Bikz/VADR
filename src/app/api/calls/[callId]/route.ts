import { NextRequest, NextResponse } from 'next/server';
import { callService } from '@/server/services/call-service';

type RouteContext = {
  params: Promise<{ callId: string }>;
};

interface UpdateCallRequest {
  isListening?: boolean;
  isTakenOver?: boolean;
  endCall?: boolean;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { callId } = await context.params;
  const payload = (await request.json()) as UpdateCallRequest;
  const callSession = callService.getCall(callId);

  if (!callSession) {
    return NextResponse.json({ error: 'Unknown call' }, { status: 404 });
  }

  if (typeof payload.isListening === 'boolean') {
    await callService.setListening(callId, payload.isListening);
  }

  if (typeof payload.isTakenOver === 'boolean') {
    await callService.setTakeOver(callId, payload.isTakenOver);
  }

  if (payload.endCall) {
    await callService.endCall(callId);
  }

  return NextResponse.json({ call: callService.getCall(callId)?.call });
}
