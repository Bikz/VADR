import OpenAI from 'openai';
import type { CallPrep, Lead, TranscriptTurn } from '@/types';
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

interface SimulateVendorResponseArgs {
  conversation: Array<{ role: 'system' | 'assistant' | 'user'; content: string }>;
  lead: Lead;
  lastTaraMessage: string;
  objective: string;
}

interface SimulateTaraResponseArgs {
  conversation: Array<{ role: 'system' | 'assistant' | 'user'; content: string }>;
  prep: CallPrep;
  lead: Lead;
  lastVendorMessage: string;
}

/**
 * Simulates a vendor's response to Tara's message
 */
export async function simulateVendorResponse({
  conversation,
  lead,
  lastTaraMessage,
  objective,
}: SimulateVendorResponseArgs): Promise<string> {
  const client = getClient();

  const vendorPrompt = `You are ${lead.name}, a business owner or employee responding to a call from Tara, an AI assistant doing research.

Business context:
- Business: ${lead.name}
- Rating: ${lead.rating} / 5 from ${lead.reviewCount} reviews
- Description: ${lead.description || 'No description available'}
- Location: ${lead.address || 'Not specified'}

Research objective: ${objective}

Tara just said: "${lastTaraMessage}"

Respond naturally as the business owner would:
- Be conversational and friendly
- Answer questions directly and helpfully
- Provide realistic business information (availability, pricing, etc.)
- Show interest but also ask clarifying questions if needed
- Keep responses under 100 words
- Sound like a real person on the phone (casual, not overly formal)

Respond in first person as the business owner/employee would:`;

  const messages = [
    { role: 'system' as const, content: vendorPrompt },
    ...conversation.filter((entry) => entry.role !== 'system').slice(-10), // Last 10 turns for context
  ];

  const response = await client.chat.completions.create({
    model: env.openAiModel(),
    messages,
    temperature: 0.7,
    max_tokens: 150,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  return text || 'Sure, I can help you with that.';
}

/**
 * Simulates Tara's response to a vendor's message (for demo purposes)
 */
export async function simulateTaraResponse({
  conversation,
  prep,
  lead,
  lastVendorMessage,
}: SimulateTaraResponseArgs): Promise<{ text: string; shouldTerminate: boolean }> {
  const client = getClient();

  const scriptSummary = prep.script
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  const variables = Object.entries(prep.variables)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');

  const turnCount = Math.floor(conversation.filter((m) => m.role !== 'system').length / 2);
  const isLongConversation = turnCount >= 7;

  const prompt = `You are Tara, an AI sales associate calling ${lead.name}. ` +
    `The goal is: ${prep.objective}. Follow this script outline: ${scriptSummary}. ` +
    `Always stay compliant with these disallowed topics: ${prep.disallowedTopics.join(', ')}. ` +
    `Red flags to listen for: ${prep.redFlags.join(', ')}. ` +
    `Important context about the lead: rating ${lead.rating} from ${lead.reviewCount} reviews, summary: ${lead.description}. ` +
    `Variables to keep in mind: ${variables}. ` +
    `The vendor just said: "${lastVendorMessage}". ` +
    `\n\nIMPORTANT INSTRUCTIONS:\n` +
    `- Introduce yourself as "Tara" (not VADR) when greeting\n` +
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

