/**
 * Client-side ElevenLabs integration for voice interaction
 */

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';

interface ElevenLabsVoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface ElevenLabsTTSParams {
  text: string;
  voice_id?: string;
  model_id?: string;
  voice_settings?: ElevenLabsVoiceSettings;
}

/**
 * Convert text to speech using ElevenLabs API (client-side)
 * This should be called from a server-side API route for security
 */
export async function textToSpeech(text: string, options?: {
  voiceId?: string;
  modelId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}): Promise<Blob> {
  // Note: In production, this should call a backend API route that has the API key
  // For now, we'll use a proxy endpoint
  const response = await fetch('/api/elevenlabs/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: options?.voiceId || '21m00Tcm4TlvDq8ikWAM', // Rachel
      model_id: options?.modelId || 'eleven_monolingual_v1',
      voice_settings: options?.voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.75,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `ElevenLabs TTS failed: ${response.status}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail?.message) {
        errorMessage = errorJson.detail.message;
      } else if (errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // If parsing fails, use the raw error text
      if (errorText) {
        errorMessage = `${errorMessage} ${errorText}`;
      }
    }
    
    // Don't throw for 401 errors - just log and return empty blob
    // This prevents the app from breaking when API key is invalid
    if (response.status === 401) {
      console.warn('ElevenLabs TTS API key issue:', errorMessage);
      console.warn('TTS will be disabled. Please check your ElevenLabs API key.');
      // Return a silent audio blob or let the calling code handle it
      throw new Error(`ElevenLabs TTS unavailable: ${errorMessage}`);
    }
    
    throw new Error(errorMessage);
  }

  return await response.blob();
}

/**
 * Play audio blob
 */
export function playAudio(audioBlob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(audioBlob);
    audio.src = url;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    audio.play().catch(reject);
  });
}

/**
 * Speak text using ElevenLabs TTS
 */
export async function speakText(text: string, options?: {
  voiceId?: string;
  modelId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}): Promise<void> {
  const audioBlob = await textToSpeech(text, options);
  await playAudio(audioBlob);
}

/**
 * Get available voices from ElevenLabs
 * This would typically be cached on the server
 */
export async function getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
  const response = await fetch('/api/elevenlabs/voices');
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }
  return response.json();
}

