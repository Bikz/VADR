import type { NextRequest } from 'next/server';
import { callService, type CallEvent } from '@/server/services/call-service';

const encoder = new TextEncoder();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');

  if (!runId) {
    return new Response(JSON.stringify({ error: 'Missing runId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: CallEvent) => {
        const payload = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      callService.subscribe(runId, send);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);

      cleanup = () => {
        clearInterval(heartbeat);
        callService.unsubscribe(runId, send);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
