import type { Prisma, PrismaClient } from '@prisma/client';
import type { Call, CallPrep, CallState, Lead, TranscriptTurn, VADRRun } from '@/types';
import type { CallSession, CallStore, CreateRunParams, RunSession } from './types';
import { prisma } from '@/lib/db';

const TERMINAL_STATES: CallState[] = ['completed', 'failed', 'voicemail'];

type PrismaRun = Prisma.RunGetPayload<{ include: { calls: { include: { transcript: true } } } }>;
type PrismaCallWithTranscript = Prisma.CallGetPayload<{ include: { transcript: true } }>;

export class PrismaCallStore implements CallStore {
  constructor(private readonly client: PrismaClient) {}

  private ensureClient() {
    if (!this.client) {
      throw new Error('Database client not configured');
    }
  }

  async createRun(params: CreateRunParams): Promise<RunSession> {
    this.ensureClient();

    const { runId, query, createdBy, prep, leads } = params;

    const run = await this.client.run.upsert({
      where: { id: runId },
      create: {
        id: runId,
        query,
        createdBy,
        status: 'calling',
        startedAt: new Date(),
        prep: prep as unknown as Prisma.InputJsonValue,
        calls: {
          create: leads.map((lead, index) => ({
            id: `call-${lead.id}-${Date.now()}-${index}`,
            leadId: lead.id,
            leadName: lead.name,
            leadPhone: lead.phone,
            leadSource: lead.source,
            leadRating: lead.rating,
            leadReviewCount: lead.reviewCount,
            leadDescription: lead.description,
            leadConfidence: lead.confidence,
            leadUrl: lead.url,
            state: 'dialing',
            sentiment: 'neutral',
            durationSeconds: 0,
          })),
        },
      },
      update: {
        query,
        createdBy,
        prep: prep as unknown as Prisma.InputJsonValue,
      },
      include: {
        calls: {
          include: { transcript: { orderBy: { timestamp: 'asc' } } },
        },
      },
    });

    return this.mapRunToSession(run, prep);
  }

  async attachCallSid(callId: string, callSid: string): Promise<void> {
    this.ensureClient();
    await this.client.call.update({
      where: { id: callId },
      data: { twilioCallSid: callSid },
    });
  }

  async findCallBySid(callSid: string): Promise<CallSession | undefined> {
    this.ensureClient();
    const call = await this.client.call.findUnique({
      where: { twilioCallSid: callSid },
      include: {
        transcript: { orderBy: { timestamp: 'asc' } },
        run: true,
      },
    });
    if (!call) return undefined;

    const run = call.run;
    const prep = run?.prep ? (run.prep as unknown as CallPrep) : null;
    const conversation = this.buildConversation(prep, call.transcript);
    return {
      runId: call.runId,
      call: this.mapCall(call),
      conversation,
      twilioCallSid: call.twilioCallSid ?? undefined,
    };
  }

  async updateCallState(callId: string, state: CallState, extra: Partial<Call> = {}): Promise<void> {
    this.ensureClient();

    await this.client.$transaction(async (tx) => {
      const existing = await tx.call.findUnique({
        where: { id: callId },
        select: { runId: true, startedAt: true, endedAt: true, state: true },
      });

      if (!existing) {
        return;
      }

      const updateData: Prisma.CallUpdateInput = {
        state,
        sentiment: extra.sentiment,
        updatedAt: new Date(),
      };

      if (typeof extra.startedAt === 'number') {
        updateData.startedAt = new Date(extra.startedAt);
      } else if (!existing.startedAt && state === 'connected') {
        updateData.startedAt = new Date();
      }

      if (typeof extra.endedAt === 'number') {
        updateData.endedAt = new Date(extra.endedAt);
      } else if (TERMINAL_STATES.includes(state) && !existing.endedAt) {
        updateData.endedAt = new Date();
      }

      if (typeof extra.duration === 'number') {
        updateData.durationSeconds = extra.duration;
      } else if (TERMINAL_STATES.includes(state) && existing.startedAt && !existing.endedAt) {
        const diffMs = Date.now() - existing.startedAt.getTime();
        updateData.durationSeconds = Math.max(Math.round(diffMs / 1000), 0);
      }

      // Handle extractedData
      if (extra.extractedData !== undefined) {
        updateData.extractedData = extra.extractedData;
      }

      await tx.call.update({
        where: { id: callId },
        data: updateData,
      });

      await this.recalculateRunStatus(tx, existing.runId);
    });
  }

  async appendTranscript(callId: string, turn: TranscriptTurn, sentiment?: Call['sentiment']): Promise<void> {
    this.ensureClient();

    await this.client.$transaction([
      this.client.transcriptTurn.upsert({
        where: { id: turn.id },
        create: {
          id: turn.id,
          callId,
          speaker: turn.speaker,
          text: turn.text,
          timestamp: new Date(turn.timestamp),
          t0Ms: turn.t0_ms ?? null,
          t1Ms: turn.t1_ms ?? null,
        },
        update: {
          text: turn.text,
          t0Ms: turn.t0_ms ?? null,
          t1Ms: turn.t1_ms ?? null,
        },
      }),
      this.client.call.update({
        where: { id: callId },
        data: {
          sentiment,
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  async getRun(runId: string): Promise<RunSession | undefined> {
    this.ensureClient();

    const run = await this.client.run.findUnique({
      where: { id: runId },
      include: {
        calls: {
          orderBy: { createdAt: 'asc' },
          include: { transcript: { orderBy: { timestamp: 'asc' } } },
        },
      },
    });
    if (!run) return undefined;

    return this.mapRunToSession(run, run.prep as unknown as CallPrep | undefined);
  }

  async getCall(callId: string): Promise<CallSession | undefined> {
    this.ensureClient();
    const call = await this.client.call.findUnique({
      where: { id: callId },
      include: {
        transcript: { orderBy: { timestamp: 'asc' } },
        run: true,
      },
    });
    if (!call) return undefined;

    const prep = call.run?.prep ? (call.run.prep as unknown as CallPrep) : null;
    return {
      runId: call.runId,
      call: this.mapCall(call),
      conversation: this.buildConversation(prep, call.transcript),
      twilioCallSid: call.twilioCallSid ?? undefined,
    };
  }

  async getConversationHistory(callId: string) {
    this.ensureClient();
    const call = await this.client.call.findUnique({
      where: { id: callId },
      include: {
        transcript: { orderBy: { timestamp: 'asc' } },
        run: true,
      },
    });
    if (!call) return [];
    const prep = call.run?.prep ? (call.run.prep as unknown as CallPrep) : null;
    return this.buildConversation(prep, call.transcript);
  }

  async getPrepForRun(runId: string): Promise<CallPrep | undefined> {
    this.ensureClient();
    const run = await this.client.run.findUnique({ where: { id: runId } });
    return (run?.prep as unknown as CallPrep) ?? undefined;
  }

  async setListening(callId: string, isListening: boolean): Promise<void> {
    this.ensureClient();
    await this.client.call.update({
      where: { id: callId },
      data: { isListening },
    });
  }

  async setTakeOver(callId: string, isTakenOver: boolean): Promise<void> {
    this.ensureClient();
    await this.client.call.update({
      where: { id: callId },
      data: { isTakenOver },
    });
  }

  private async recalculateRunStatus(client: PrismaClient | Prisma.TransactionClient, runId: string) {
    const run = await client.run.findUnique({
      where: { id: runId },
      select: { status: true },
    });

    if (!run) return;

    const calls = await client.call.findMany({
      where: { runId },
      select: { state: true },
    });

    if (calls.length === 0) return;

    const allTerminal = calls.every((call) => TERMINAL_STATES.includes(call.state as CallState));
    const nextStatus: VADRRun['status'] = allTerminal ? 'completed' : 'calling';

    if (run.status === nextStatus) {
      return;
    }

    await client.run.update({
      where: { id: runId },
      data: {
        status: nextStatus,
        updatedAt: new Date(),
      },
    });
  }

  private mapRunToSession(run: PrismaRun | null, prep: CallPrep | undefined): RunSession {
    if (!run) {
      throw new Error('Run not found');
    }

    const effectivePrep = prep ?? (run.prep ? (run.prep as unknown as CallPrep) : undefined);
    if (!effectivePrep) {
      throw new Error(`Run ${run.id} is missing prep configuration`);
    }

    const leadMap: Record<string, Lead> = {};
    const calls = run.calls.map((call) => {
      const lead = this.mapLead(call);
      leadMap[lead.id] = lead;
      return this.mapCall(call, lead);
    });

    return {
      run: {
        id: run.id,
        query: run.query,
        createdBy: run.createdBy,
        startedAt: run.startedAt.getTime(),
        status: run.status as VADRRun['status'],
        calls,
      },
      prep: effectivePrep,
      leadMap,
      callIds: calls.map((call) => call.id),
    };
  }

  private mapCall(call: PrismaCallWithTranscript, leadOverride?: Lead): Call {
    const lead = leadOverride ?? this.mapLead(call);

    return {
      id: call.id,
      leadId: lead.id,
      lead,
      state: call.state as CallState,
      startedAt: call.startedAt ? call.startedAt.getTime() : undefined,
      endedAt: call.endedAt ? call.endedAt.getTime() : undefined,
      duration: call.durationSeconds ?? 0,
      transcript: call.transcript.map((turn) => ({
        id: turn.id,
        speaker: turn.speaker as TranscriptTurn['speaker'],
        text: turn.text,
        timestamp: turn.timestamp.getTime(),
        t0_ms: turn.t0Ms ?? turn.timestamp.getTime(),
        t1_ms: turn.t1Ms ?? turn.timestamp.getTime(),
      })),
      sentiment: (call.sentiment as Call['sentiment']) ?? 'neutral',
      isListening: call.isListening,
      isTakenOver: call.isTakenOver,
      extractedData: call.extractedData
        ? (call.extractedData as Call['extractedData'])
        : undefined,
    };
  }

  private mapLead(call: PrismaCallWithTranscript): Lead {
    return {
      id: call.leadId,
      name: call.leadName,
      phone: call.leadPhone,
      source: call.leadSource ?? 'Unknown',
      confidence: call.leadConfidence ?? 0,
      rating: call.leadRating ?? 0,
      reviewCount: call.leadReviewCount ?? 0,
      description: call.leadDescription ?? '',
      url: call.leadUrl ?? undefined,
    };
  }

  private buildConversation(prep: CallPrep | null, transcript: PrismaCallWithTranscript['transcript']) {
    const conversation: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [];
    if (prep) {
      conversation.push({
        role: 'system',
        content: `You are Tara, an AI assistant calling businesses to accomplish the objective: ${prep.objective}. Introduce yourself as "Tara" when greeting. Follow the script flow and stay polite. Avoid disallowed topics: ${prep.disallowedTopics.join(', ')}.`,
      });
    }
    transcript.forEach((turn) => {
      conversation.push({
        role: turn.speaker === 'ai' ? 'assistant' : 'user',
        content: turn.text,
      });
    });
    return conversation;
  }
}

export const prismaCallStore = prisma ? new PrismaCallStore(prisma) : null;
