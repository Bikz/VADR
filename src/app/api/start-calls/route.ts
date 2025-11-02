import { NextResponse } from 'next/server';
import type { CallPrep, Lead } from '@/types';
import { callService } from '@/server/services/call-service';

interface StartCallsRequest {
  runId?: string;
  query: string;
  leads: Lead[];
  prep: CallPrep;
  createdBy?: string;
}

export async function POST(request: Request) {
  const data = (await request.json()) as StartCallsRequest;

  if (!data?.query || !Array.isArray(data.leads) || data.leads.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const runId = data.runId ?? `run-${Date.now()}`;
  const createdBy = data.createdBy ?? 'vadr-user';

  try {
    console.log('[start-calls] starting run', {
      runId,
      createdBy,
      leadCount: data.leads.length,
      manualOverride: Boolean(process.env.NEXT_PUBLIC_TEST_PHONE),
      leads: data.leads.map(lead => ({ id: lead.id, phone: lead.phone })),
    });

    const { run } = await callService.startRun({
      runId,
      query: data.query,
      leads: data.leads,
      prep: data.prep,
      createdBy,
    });

    return NextResponse.json({
      runId,
      run,
    });
  } catch (error) {
    console.error('[start-calls] failed to start run', {
      runId,
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start calls' },
      { status: 500 }
    );
  }
}
