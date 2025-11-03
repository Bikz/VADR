import type { Call, CallPrep, Lead, TranscriptTurn } from '@vadr/shared';
import { callStore } from '@/server/store';
import OpenAI from 'openai';
import { env } from '@/lib/env';

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

interface SimulatedConversation {
  turns: Array<{
    speaker: 'ai' | 'human';
    text: string;
  }>;
  extractedData: {
    price?: string;
    availability?: string;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  outcome: 'completed' | 'voicemail' | 'failed';
}

/**
 * Generate a realistic conversation using OpenAI based on the business and call objective
 */
async function generateConversation(
  lead: Lead,
  prep: CallPrep
): Promise<SimulatedConversation> {
  const client = getClient();

  const prompt = `You are simulating a phone conversation between an AI agent (Tara) calling a business and a human employee answering.

Business Details:
- Name: ${lead.name}
- Description: ${lead.description}
- Rating: ${lead.rating}/5 (${lead.reviewCount} reviews)

Call Objective: ${prep.objective}

Generate a realistic phone conversation with 4-6 exchanges. The conversation should:
1. Start with the business answering the phone
2. Tara introduces herself and explains why she's calling
3. The employee responds naturally (can be helpful, busy, or mixed)
4. Include realistic small talk and information gathering
5. End naturally after gathering the needed information

Also determine:
- Extracted data (price quote and availability if applicable)
- Overall sentiment (positive/neutral/negative)
- Outcome (completed/voicemail/failed)

Return ONLY valid JSON in this exact format:
{
  "turns": [
    {"speaker": "human", "text": "Hello, this is ${lead.name.split(' ')[0]}, how can I help you?"},
    {"speaker": "ai", "text": "Hi! This is Tara. I'm calling to ask about..."},
    ...
  ],
  "extractedData": {
    "price": "$50-$80",
    "availability": "Walk-ins welcome, appointments preferred"
  },
  "sentiment": "positive",
  "outcome": "completed"
}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a conversation simulator. Return ONLY valid JSON, no markdown or additional text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content) as SimulatedConversation;

    // Ensure we have at least some turns
    if (!parsed.turns || parsed.turns.length === 0) {
      throw new Error('No turns generated');
    }

    return parsed;
  } catch (error) {
    console.error('Error generating conversation:', error);

    // Fallback to a simple conversation
    return {
      turns: [
        { speaker: 'human', text: `Hello, this is ${lead.name}, how can I help you?` },
        { speaker: 'ai', text: `Hi! This is Tara. ${prep.objective}` },
        { speaker: 'human', text: "Sure, let me check on that for you." },
        { speaker: 'ai', text: "Thank you, I appreciate it!" },
        { speaker: 'human', text: "We're available today and our pricing starts at around $50." },
        { speaker: 'ai', text: "Perfect! Thank you so much for the information. Have a great day!" },
      ],
      extractedData: {
        price: '$50+',
        availability: 'Available today',
      },
      sentiment: 'positive',
      outcome: 'completed',
    };
  }
}

/**
 * Simulate a call by progressively adding transcript turns
 */
export async function simulateCall(
  callId: string,
  runId: string,
  lead: Lead,
  prep: CallPrep
): Promise<void> {
  console.log('[demo-simulator] Starting simulation for call:', callId);

  // Generate the full conversation
  const conversation = await generateConversation(lead, prep);

  // Wait a moment for the Twilio call to initiate
  await new Promise(resolve => setTimeout(resolve, 2000));

  const startedAt = Date.now();

  // Update call to connected state
  await callStore.updateCallState(callId, 'connected', {
    startedAt,
  });

  // Add transcript turns progressively (every 3-5 seconds)
  const delayBetweenTurns = Math.max(2000, Math.min(5000, 25000 / conversation.turns.length));

  for (let i = 0; i < conversation.turns.length; i++) {
    const turn = conversation.turns[i];
    const currentTime = Date.now();
    const elapsedMs = currentTime - startedAt;

    const transcriptTurn: TranscriptTurn = {
      id: `turn-${callId}-${i}`,
      speaker: turn.speaker,
      text: turn.text,
      timestamp: currentTime,
      t0_ms: elapsedMs,
      t1_ms: elapsedMs + turn.text.length * 50, // Approximate speaking duration
    };

    await callStore.appendTranscript(callId, transcriptTurn, conversation.sentiment);
    console.log(`[demo-simulator] Added turn ${i + 1}/${conversation.turns.length} for call ${callId}`);

    // Wait before adding next turn (unless it's the last one)
    if (i < conversation.turns.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenTurns));
    }
  }

  // Final delay before completing
  await new Promise(resolve => setTimeout(resolve, 2000));

  const endedAt = Date.now();
  const duration = Math.floor((endedAt - startedAt) / 1000);

  // Update call with final state
  await callStore.updateCallState(callId, conversation.outcome, {
    endedAt,
    duration,
    sentiment: conversation.sentiment,
    extractedData: conversation.extractedData,
  });

  console.log('[demo-simulator] Completed simulation for call:', callId);
}
