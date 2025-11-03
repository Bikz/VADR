import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { simulateVendorResponse, simulateTaraResponse } from '../lib/demo-simulator.js';
import { callStore, type CallStore, type RunSession } from '../server/store/index.js';
import { createTranscriptTurn } from '../lib/transcript.js';
import { extractKeyInfo } from '../lib/info-extractor.js';
import type { CallPrep, Lead } from '../types/index.js';

const simulateVendorRequestSchema = z.object({
  runId: z.string(),
  callId: z.string(),
  conversation: z.array(z.object({
    role: z.enum(['system', 'assistant', 'user']),
    content: z.string(),
  })),
  lastTaraMessage: z.string(),
  objective: z.string(),
});

const simulateConversationRequestSchema = z.object({
  runId: z.string(),
  callId: z.string(),
  autoSimulate: z.boolean().optional().default(true),
});

const userVendorResponseSchema = z.object({
  runId: z.string(),
  callId: z.string(),
  userTranscript: z.string(),
});

export async function demoRoutes(fastify: FastifyInstance) {
  // POST /api/demo/simulate-vendor - Simulate vendor response
  fastify.post('/demo/simulate-vendor', async (request: FastifyRequest, reply: FastifyReply) => {
    let data;
    try {
      data = simulateVendorRequestSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid payload', details: error });
    }

    try {
      const callSession = await callStore.getCall(data.callId);
      const runSession = await callStore.getRun(data.runId);

      if (!callSession || !runSession) {
        return reply.code(404).send({ error: 'Call or run not found' });
      }

      const vendorResponse = await simulateVendorResponse({
        conversation: data.conversation,
        lead: callSession.call.lead,
        lastTaraMessage: data.lastTaraMessage,
        objective: runSession.prep.objective,
      });

      // Add vendor turn to transcript
      const vendorTurn = createTranscriptTurn(data.callId, 'human', vendorResponse);
      await callStore.appendTranscript(data.callId, vendorTurn);

      return reply.send({
        text: vendorResponse,
      });
    } catch (error) {
      console.error('[demo] failed to simulate vendor response', {
        callId: data.callId,
        error,
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to simulate vendor response',
      });
    }
  });

  // POST /api/demo/user-vendor-response - Handle user speaking as vendor (takeover mode)
  fastify.post('/demo/user-vendor-response', async (request: FastifyRequest, reply: FastifyReply) => {
    let data;
    try {
      data = userVendorResponseSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid payload', details: error });
    }

    try {
      const callSession = await callStore.getCall(data.callId);
      const runSession = await callStore.getRun(data.runId);

      if (!callSession || !runSession) {
        return reply.code(404).send({ error: 'Call or run not found' });
      }

      if (!callSession.call.isTakenOver) {
        return reply.code(400).send({ error: 'Call is not in takeover mode' });
      }

      // Add user's speech as vendor response
      const vendorTurn = createTranscriptTurn(data.callId, 'human', data.userTranscript);
      await callStore.appendTranscript(data.callId, vendorTurn);

      // Generate Tara's response to the user's input
      const conversation = await callStore.getConversationHistory(data.callId);
      const taraReply = await simulateTaraResponse({
        conversation,
        prep: runSession.prep,
        lead: callSession.call.lead,
        lastVendorMessage: data.userTranscript,
      });

        const taraTurn = createTranscriptTurn(data.callId, 'ai', taraReply.text);
        await callStore.appendTranscript(data.callId, taraTurn);

        // Extract key info from conversation
        const updatedCallSession = await callStore.getCall(data.callId);
        if (updatedCallSession) {
          const extracted = await extractKeyInfo(updatedCallSession.call.transcript);
          const existingData = updatedCallSession.call.extractedData || {};
          const merged = {
            ...existingData,
            ...extracted,
          };
          if (merged.price || merged.availability || merged.notes) {
            await callStore.updateCallState(data.callId, updatedCallSession.call.state, {
              extractedData: merged,
            });
          }
        }

        return reply.send({
          taraResponse: taraReply.text,
          shouldTerminate: taraReply.shouldTerminate,
        });
    } catch (error) {
      console.error('[demo] failed to handle user vendor response', {
        callId: data.callId,
        error,
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to process user response',
      });
    }
  });

  // POST /api/demo/simulate-conversation - Auto-simulate a conversation turn
  fastify.post('/demo/simulate-conversation', async (request: FastifyRequest, reply: FastifyReply) => {
    let data;
    try {
      data = simulateConversationRequestSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid payload', details: error });
    }

    try {
      const callSession = await callStore.getCall(data.callId);
      const runSession = await callStore.getRun(data.runId);

      if (!callSession || !runSession) {
        return reply.code(404).send({ error: 'Call or run not found' });
      }

      const conversation = await callStore.getConversationHistory(data.callId);
      
      // If no transcript exists, start with Tara's initial greeting
      if (callSession.call.transcript.length === 0) {
        // Generate initial Tara greeting
        const taraReply = await simulateTaraResponse({
          conversation: [
            {
              role: 'system',
              content: `You are Tara, an AI assistant calling ${callSession.call.lead.name}. Goal: ${runSession.prep.objective}. Introduce yourself as "Tara" when greeting. Be polite and brief.`,
            },
          ],
          prep: runSession.prep,
          lead: callSession.call.lead,
          lastVendorMessage: 'Hello?',
        });

        const taraTurn = createTranscriptTurn(data.callId, 'ai', taraReply.text);
        await callStore.appendTranscript(data.callId, taraTurn);

        // Extract key info from conversation so far
        const updatedCallSession = await callStore.getCall(data.callId);
        if (updatedCallSession) {
          const extracted = await extractKeyInfo(updatedCallSession.call.transcript);
          if (extracted.price || extracted.availability || extracted.notes) {
            await callStore.updateCallState(data.callId, updatedCallSession.call.state, {
              extractedData: extracted,
            });
          }
        }

        return reply.send({
          vendorResponse: null,
          taraResponse: taraReply.text,
          shouldTerminate: taraReply.shouldTerminate,
        });
      }

      const lastTurn = callSession.call.transcript[callSession.call.transcript.length - 1];

      let vendorResponse: string | null = null;
      let taraResponse: string | null = null;
      let shouldTerminate = false;

      // If last turn was from Tara (AI), simulate vendor response
      if (lastTurn.speaker === 'ai') {
        vendorResponse = await simulateVendorResponse({
          conversation,
          lead: callSession.call.lead,
          lastTaraMessage: lastTurn.text,
          objective: runSession.prep.objective,
        });

        const vendorTurn = createTranscriptTurn(data.callId, 'human', vendorResponse);
        await callStore.appendTranscript(data.callId, vendorTurn);

        // Extract key info after vendor response
        const updatedCallAfterVendor = await callStore.getCall(data.callId);
        if (updatedCallAfterVendor) {
          const extracted = await extractKeyInfo(updatedCallAfterVendor.call.transcript);
          const existingData = updatedCallAfterVendor.call.extractedData || {};
          const merged = {
            ...existingData,
            ...extracted,
          };
          if (merged.price || merged.availability || merged.notes) {
            await callStore.updateCallState(data.callId, updatedCallAfterVendor.call.state, {
              extractedData: merged,
            });
          }
        }

        // If auto-simulate is enabled, also generate Tara's response (with delay for realism)
        if (data.autoSimulate) {
          // Add realistic delay (2-4 seconds) before Tara responds
          await new Promise(resolve => setTimeout(resolve, 2500 + Math.random() * 1500));
          
          const updatedConversation = await callStore.getConversationHistory(data.callId);
          const taraReply = await simulateTaraResponse({
            conversation: updatedConversation,
            prep: runSession.prep,
            lead: callSession.call.lead,
            lastVendorMessage: vendorResponse,
          });

          taraResponse = taraReply.text;
          shouldTerminate = taraReply.shouldTerminate;

          const taraTurn = createTranscriptTurn(data.callId, 'ai', taraResponse);
          await callStore.appendTranscript(data.callId, taraTurn);

          // Extract key info after Tara response
          const updatedCallAfterTara = await callStore.getCall(data.callId);
          if (updatedCallAfterTara) {
            const extracted = await extractKeyInfo(updatedCallAfterTara.call.transcript);
            const existingData = updatedCallAfterTara.call.extractedData || {};
            const merged = {
              ...existingData,
              ...extracted,
            };
            if (merged.price || merged.availability || merged.notes) {
              await callStore.updateCallState(data.callId, updatedCallAfterTara.call.state, {
                extractedData: merged,
              });
            }
          }

          if (shouldTerminate) {
            await callStore.updateCallState(data.callId, 'completed');
          }
        }
      } else {
        // If last turn was from vendor (human), simulate Tara response (with delay)
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
        
        const taraReply = await simulateTaraResponse({
          conversation,
          prep: runSession.prep,
          lead: callSession.call.lead,
          lastVendorMessage: lastTurn.text,
        });

        taraResponse = taraReply.text;
        shouldTerminate = taraReply.shouldTerminate;

        const taraTurn = createTranscriptTurn(data.callId, 'ai', taraResponse);
        await callStore.appendTranscript(data.callId, taraTurn);

        // Extract key info after Tara response
        const updatedCallAfterTara = await callStore.getCall(data.callId);
        if (updatedCallAfterTara) {
          const extracted = await extractKeyInfo(updatedCallAfterTara.call.transcript);
          const existingData = updatedCallAfterTara.call.extractedData || {};
          const merged = {
            ...existingData,
            ...extracted,
          };
          if (merged.price || merged.availability || merged.notes) {
            await callStore.updateCallState(data.callId, updatedCallAfterTara.call.state, {
              extractedData: merged,
            });
          }
        }

        if (shouldTerminate) {
          await callStore.updateCallState(data.callId, 'completed');
        }
      }

      return reply.send({
        vendorResponse,
        taraResponse,
        shouldTerminate,
      });
    } catch (error) {
      console.error('[demo] failed to simulate conversation', {
        callId: data.callId,
        error,
      });
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to simulate conversation',
      });
    }
  });
}
