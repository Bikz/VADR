import type { NextRequest } from 'next/server';
import { callService } from '@/server/services/call-service';

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
      let active = true;
      let lastSignature: string | null = null;

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);

      const poll = async () => {
        if (!active) return;

        try {
          const session = await callService.getRun(runId);
          if (session) {
            const snapshot = {
              type: 'snapshot' as const,
              run: session.run,
            };

            const signature = JSON.stringify(snapshot.run);
            if (signature !== lastSignature) {
              lastSignature = signature;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
            }
          }
        } catch (error) {
          console.error('[events] failed to poll run', error);
        } finally {
          if (active) {
            setTimeout(poll, 1000);
          }
        }
      };

      void poll();
      cleanup = () => {
        active = false;
        clearInterval(heartbeat);
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
