import { env } from './env';

export interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ElevenLabsTTSOptions {
  text: string;
  voice_id?: string;
  model_id?: string;
  voice_settings?: ElevenLabsVoiceSettings;
}

/**
 * Convert text to speech using ElevenLabs API
 */
export async function textToSpeech(text: string, options?: {
  voiceId?: string;
  modelId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}): Promise<ArrayBuffer> {
  const apiKey = env.elevenLabsApiKey();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const voiceId = options?.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
  const modelId = options?.modelId || 'eleven_monolingual_v1';
  const voiceSettings = options?.voiceSettings || {
    stability: 0.5,
    similarity_boost: 0.75,
    use_speaker_boost: true,
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer;
}

/**
 * Convert speech to text using ElevenLabs Speech-to-Text API
 * Note: ElevenLabs doesn't have a direct STT API, but we can use their conversational AI
 * For now, we'll note that STT should be handled by the browser's Web Speech API or another service
 */
export async function speechToText(audioBuffer: ArrayBuffer): Promise<string> {
  // ElevenLabs doesn't provide STT directly
  // This would need to use a different service like OpenAI Whisper or browser Web Speech API
  throw new Error('ElevenLabs STT not directly available. Use OpenAI Whisper or browser Web Speech API instead.');
}

