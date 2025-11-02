import OpenAI from 'openai';
import type { CallPrep, Lead } from '@/types';
import { env } from './env';

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = env.openAiApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

interface GenerateAgentReplyArgs {
  conversation: Array<{ role: 'system' | 'assistant' | 'user'; content: string }>;
  prep: CallPrep;
  lead: Lead;
  lastUtterance: string;
}

export async function generateAgentReply({
  conversation,
  prep,
  lead,
  lastUtterance,
}: GenerateAgentReplyArgs): Promise<string> {
  const client = getClient();

  const scriptSummary = prep.script
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  const variables = Object.entries(prep.variables)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');

  const prompt = `You are VADR, an AI sales associate calling ${lead.name}. ` +
    `The goal is: ${prep.objective}. Follow this script outline: ${scriptSummary}. ` +
    `Always stay compliant with these disallowed topics: ${prep.disallowedTopics.join(', ')}. ` +
    `Red flags to listen for: ${prep.redFlags.join(', ')}. ` +
    `Important context about the lead: rating ${lead.rating} from ${lead.reviewCount} reviews, summary: ${lead.description}. ` +
    `Variables to keep in mind: ${variables}. ` +
    `You just heard: "${lastUtterance}". Respond in a warm, concise tone and end with a question when appropriate.`;

  const messages = [
    { role: 'system' as const, content: prompt },
    ...conversation.filter((entry) => entry.role !== 'system'),
  ];

  const response = await client.chat.completions.create({
    model: env.openAiModel(),
    messages,
    temperature: 0.4,
    max_tokens: 220,
  });

  const text = response.choices[0]?.message?.content ?? '';
  return text.trim() || 'Thanks for the information. Could you share a bit more?';
}

