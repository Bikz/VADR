'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speakText } from '@/lib/elevenlabs-client';

interface DemoVoiceControlProps {
  callId: string;
  runId: string;
  isTakenOver: boolean;
  onStartSpeaking: () => void;
  onStopSpeaking: () => void;
  lastMessage?: string;
}

export function DemoVoiceControl({
  callId,
  runId,
  isTakenOver,
  onStartSpeaking,
  onStopSpeaking,
  lastMessage,
}: DemoVoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        
        // Send transcript to backend as vendor response
        try {
          setIsProcessing(true);
          
          // Import apiClient dynamically to avoid circular dependencies
          const { apiClient } = await import('@/lib/api-client');
          
          // Send user's speech as vendor response and get Tara's reply
          const response = await fetch(`${apiClient.getBaseUrl()}/api/demo/user-vendor-response`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              runId,
              callId,
              userTranscript: transcript,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to send user response: ${response.status}`);
          }

          const data = await response.json();
          
          // Play Tara's response if available (with error handling)
          if (data.taraResponse) {
            try {
              const { speakText } = await import('@/lib/elevenlabs-client');
              await speakText(data.taraResponse);
            } catch (ttsError) {
              // TTS failed, but transcript still updates - just log warning
              console.warn('Could not play audio response, but transcript was updated.');
              // Don't show alert - this is not critical
            }
          }
          
          console.log('User said (as vendor):', transcript);
          console.log('Tara responded:', data.taraResponse);
          
        } catch (error) {
          console.error('Error processing speech:', error);
          alert('Failed to process your speech. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        
        // Handle different error types
        let errorMessage = 'Speech recognition error';
        switch (event.error) {
          case 'network':
            // Network errors are expected - Speech Recognition API requires internet
            // Don't log as error, just inform user silently
            console.warn('Speech recognition requires internet connection');
            errorMessage = 'Network error: Speech recognition requires internet connection. Please check your connection.';
            break;
          case 'no-speech':
            // This is normal if user doesn't speak - don't log as error
            console.log('No speech detected');
            return; // Don't show error for no-speech, just return
          case 'audio-capture':
            console.error('Microphone not available:', event.error);
            errorMessage = 'Microphone not available. Please check your microphone permissions.';
            break;
          case 'not-allowed':
            console.error('Microphone permission denied:', event.error);
            errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
            break;
          case 'aborted':
            // User stopped recognition - this is normal
            console.log('Speech recognition aborted');
            return;
          default:
            console.error('Speech recognition error:', event.error);
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        
        // Only show alert for critical errors (not network, which is informational)
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          alert(errorMessage);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleStartListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      onStartSpeaking();
      recognitionRef.current.start();
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      onStopSpeaking();
    }
  };

  const handleSpeak = async () => {
    if (!lastMessage) return;

    try {
      setIsSpeaking(true);
      await speakText(lastMessage);
    } catch (error) {
      console.error('Error speaking text:', error);
      // Show user-friendly message for TTS errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('ElevenLabs') || errorMessage.includes('401')) {
        // TTS is unavailable - don't show annoying alert, just log
        console.warn('Text-to-speech is currently unavailable. Transcript will still update.');
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  if (!isTakenOver) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 border-t border-gray-200 bg-gray-50">
      <Button
        size="sm"
        variant={isListening ? 'default' : 'outline'}
        onClick={isListening ? handleStopListening : handleStartListening}
        disabled={isProcessing || isSpeaking}
        className="flex-1 h-8 text-xs"
      >
        {isProcessing ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : isListening ? (
          <MicOff className="mr-1.5 h-3.5 w-3.5" />
        ) : (
          <Mic className="mr-1.5 h-3.5 w-3.5" />
        )}
        {isListening ? 'Stop Listening' : 'Start Speaking'}
      </Button>
      {lastMessage && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSpeak}
          disabled={isSpeaking || isProcessing}
          className="h-8 px-3"
        >
          {isSpeaking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

