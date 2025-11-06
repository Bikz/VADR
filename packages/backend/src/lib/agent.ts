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

  const prompt = `You are Tara, a friendly research assistant calling ${lead.name}. ` +
    `Your goal is to have a natural conversation to learn about: ${prep.objective}. ` +
    `Script outline to follow: ${scriptSummary}. ` +
    `Always stay compliant with these disallowed topics: ${prep.disallowedTopics.join(', ')}. ` +
    `Red flags to listen for: ${prep.redFlags.join(', ')}. ` +
    `Context about this business: ${lead.rating} stars from ${lead.reviewCount} reviews. ${lead.description}. ` +
    `Key details to remember: ${variables}. ` +
    `The person just said: "${lastUtterance}". ` +
    `\n\nIMPORTANT INSTRUCTIONS:\n` +
    `- Speak naturally and conversationally, like a real person making a quick call\n` +
    `- Keep responses brief and friendly (under 150 characters when possible)\n` +
    `- Ask one clear question at a time\n` +
    `- If they reach voicemail, immediately recognize it and end the call\n` +
    `- End the call when: (1) you've gathered what you need, (2) they're not interested, (3) they ask to end, (4) you reach a voicemail, or (5) you've had 8+ exchanges\n` +
    `- To end the call, start your response with [END_CALL] followed by a brief, warm goodbye\n` +
    `- Example ending: "[END_CALL] Thank you so much for your time! Have a great day!"\n` +
    `${isLongConversation ? '- NOTE: This conversation is getting long. Consider wrapping up gracefully.\n' : ''}` +
    `- Be warm, professional, and respectful of their time.`;

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

