import OpenAI from 'openai';
import type { CallPrep, Lead } from '@vadr/shared';
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

interface AgentReply {
  text: string;
  shouldTerminate: boolean;
}

export async function generateAgentReply({
  conversation,
  prep,
  lead,
  lastUtterance,
}: GenerateAgentReplyArgs): Promise<AgentReply> {
  const client = getClient();

  const scriptSummary = prep.script
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  const variables = Object.entries(prep.variables)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');

  // Calculate conversation length to provide context
  const turnCount = Math.floor(conversation.filter((m) => m.role !== 'system').length / 2);
  const isLongConversation = turnCount >= 7;

  const prompt = `You are VADR, an AI sales associate calling ${lead.name}. ` +
    `The goal is: ${prep.objective}. Follow this script outline: ${scriptSummary}. ` +
    `Always stay compliant with these disallowed topics: ${prep.disallowedTopics.join(', ')}. ` +
    `Red flags to listen for: ${prep.redFlags.join(', ')}. ` +
    `Important context about the lead: rating ${lead.rating} from ${lead.reviewCount} reviews, summary: ${lead.description}. ` +
    `Variables to keep in mind: ${variables}. ` +
    `You just heard: "${lastUtterance}". ` +
    `\n\nIMPORTANT INSTRUCTIONS:\n` +
    `- Keep responses under 150 characters when possible\n` +
    `- End the call when: (1) you've gathered all needed information, (2) the lead is clearly not interested, (3) the lead asks to end, or (4) you've had 8+ exchanges\n` +
    `- To end the call, start your response with [END_CALL] followed by a brief goodbye\n` +
    `- Example ending: "[END_CALL] Thank you so much for your time! We'll follow up via email. Have a great day!"\n` +
    `${isLongConversation ? '- NOTE: This conversation is getting long. Consider wrapping up gracefully.\n' : ''}` +
    `- Respond in a warm, concise tone and end with a question when appropriate (unless ending call).`;

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

  let text = response.choices[0]?.message?.content?.trim() ?? '';

  // Check for termination signal
  let shouldTerminate = false;
  if (text.startsWith('[END_CALL]')) {
    shouldTerminate = true;
    text = text.replace('[END_CALL]', '').trim();
  }

  // Fallback if no text generated
  if (!text) {
    text = 'Thanks for the information. Could you share a bit more?';
  }

  return { text, shouldTerminate };
}

