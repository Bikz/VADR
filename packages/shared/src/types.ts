import { z } from 'zod';

export const callStateSchema = z.union([
  z.literal('idle'),
  z.literal('dialing'),
  z.literal('ringing'),
  z.literal('connected'),
  z.literal('voicemail'),
  z.literal('completed'),
  z.literal('failed'),
]);

export type CallState = z.infer<typeof callStateSchema>;

export const speakerSchema = z.union([z.literal('ai'), z.literal('human')]);
export type Speaker = z.infer<typeof speakerSchema>;

export const sentimentSchema = z.union([z.literal('positive'), z.literal('neutral'), z.literal('negative')]);
export type Sentiment = z.infer<typeof sentimentSchema>;

export const transcriptTurnSchema = z.object({
  id: z.string(),
  speaker: speakerSchema,
  text: z.string(),
  timestamp: z.number(),
  t0_ms: z.number(),
  t1_ms: z.number(),
});

export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

export const leadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  source: z.string(),
  url: z.string().optional(),
  address: z.string().optional(),
  confidence: z.number(),
  rating: z.number(),
  reviewCount: z.number(),
  description: z.string(),
  distance: z.number().nullable().optional(),
});

export type Lead = z.infer<typeof leadSchema>;

export const callSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  lead: leadSchema,
  state: callStateSchema,
  startedAt: z.number().optional(),
  endedAt: z.number().optional(),
  duration: z.number(),
  transcript: z.array(transcriptTurnSchema),
  sentiment: sentimentSchema,
  isListening: z.boolean(),
  isTakenOver: z.boolean(),
  extractedData: z
    .object({
      price: z.string().optional(),
      availability: z.string().optional(),
      notes: z.string().optional(),
      hours: z.string().optional(),
      insuranceAccepted: z.string().optional(),
      skus: z.array(z.string()).optional(),
      priceRange: z.string().optional(),
    })
    .optional(),
});

export type Call = z.infer<typeof callSchema>;

export const callPrepSchema = z.object({
  objective: z.string(),
  script: z.string(),
  variables: z.record(z.string()),
  redFlags: z.array(z.string()),
  disallowedTopics: z.array(z.string()),
});

export type CallPrep = z.infer<typeof callPrepSchema>;

export const vadrRunStatusSchema = z.union([z.literal('searching'), z.literal('calling'), z.literal('completed')]);
export type VADRRunStatus = z.infer<typeof vadrRunStatusSchema>;

export const vadrRunSchema = z.object({
  id: z.string(),
  query: z.string(),
  createdBy: z.string(),
  startedAt: z.number(),
  status: vadrRunStatusSchema,
  calls: z.array(callSchema),
});

export type VADRRun = z.infer<typeof vadrRunSchema>;

export const startCallsRequestSchema = z.object({
  runId: z.string().optional(),
  query: z.string(),
  leads: z.array(leadSchema),
  prep: callPrepSchema,
  createdBy: z.string().optional(),
});

export type StartCallsRequest = z.infer<typeof startCallsRequestSchema>;

export const startCallsResponseSchema = z.object({
  runId: z.string(),
  run: vadrRunSchema,
});

export type StartCallsResponse = z.infer<typeof startCallsResponseSchema>;

export const callActionSchema = z.object({
  action: z.union([z.literal('listen'), z.literal('takeover'), z.literal('end')]),
  value: z.boolean().optional(),
});

export type CallActionRequest = z.infer<typeof callActionSchema>;

export const callEventSchema = z.object({
  type: z.literal('snapshot'),
  run: vadrRunSchema,
});

export type CallEvent = z.infer<typeof callEventSchema>;
