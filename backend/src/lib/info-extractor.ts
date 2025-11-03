import OpenAI from 'openai';
import type { TranscriptTurn } from '@/types';
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

interface ExtractedInfo {
  price?: string;
  availability?: string;
  notes?: string;
}

/**
 * Extract key information from conversation transcript in real-time
 */
export async function extractKeyInfo(transcript: TranscriptTurn[]): Promise<ExtractedInfo> {
  if (transcript.length === 0) {
    return {};
  }

  const client = getClient();

  // Build conversation text
  const conversationText = transcript
    .map(turn => `${turn.speaker === 'ai' ? 'Tara' : 'Vendor'}: ${turn.text}`)
    .join('\n');

  const prompt = `Analyze this phone conversation transcript and extract key business information.
Extract ONLY the following if mentioned:
- Price or pricing information (any monetary values, rates, costs)
- Availability (times, dates, appointment availability)
- Important notes (special requirements, next steps, follow-ups)

Return ONLY a JSON object with keys: price, availability, notes. Use null for missing information.
Do not include any other text, just the JSON object.

Transcript:
${conversationText}

JSON:`;

  try {
    const response = await client.chat.completions.create({
      model: env.openAiModel(),
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured information from conversations. Always return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '{}';
    const parsed = JSON.parse(text) as ExtractedInfo;
    
    // Clean up and validate
    return {
      price: parsed.price && typeof parsed.price === 'string' ? parsed.price : undefined,
      availability: parsed.availability && typeof parsed.availability === 'string' ? parsed.availability : undefined,
      notes: parsed.notes && typeof parsed.notes === 'string' ? parsed.notes : undefined,
    };
  } catch (error) {
    console.error('[info-extractor] Failed to extract info', {
      error: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    return {};
  }
}

