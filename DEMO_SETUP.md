# Demo Setup Guide

This guide explains how to set up and run the interactive demo with OpenAI conversation simulation and ElevenLabs voice takeover.

## Environment Variables

### Backend (.env or environment)

Add the following to your backend environment:

```bash
# OpenAI API Key (for conversation simulation)
OPENAI_API_KEY=your-openai-api-key-here

# ElevenLabs API Key (for voice interaction)
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here
```

### Frontend (.env.local)

Add to your Next.js `.env.local` file (optional, since we're using API routes):

```bash
# The frontend uses API routes, so the API key is stored server-side
# No frontend env vars needed for ElevenLabs
```

## Features

### 1. Conversation Simulation

The demo uses OpenAI to simulate realistic conversations between:
- **Tara (AI)**: Your AI assistant making the call
- **Vendor**: The business owner/employee receiving the call

Both sides are simulated using OpenAI GPT models, creating natural back-and-forth conversations.

### 2. Voice Takeover with ElevenLabs

Users can take over the conversation mid-call:
1. Click "Take Over" button on any active call
2. Use the microphone to speak as the vendor
3. Your voice is transcribed and sent as the vendor's response
4. Tara responds to your input using OpenAI
5. Responses are spoken using ElevenLabs TTS

### 3. Auto-Simulation

- Click "Simulate Next Turn" to advance the conversation
- Both sides respond automatically when `autoSimulate=true`
- Watch realistic business conversations unfold

## Running the Demo

1. **Start the backend server:**
   ```bash
   cd backend
   bun install
   bun run dev
   ```

2. **Start the frontend:**
   ```bash
   bun install
   bun run dev
   ```

3. **Navigate to the interactive demo:**
   ```
   http://localhost:3000/calls/demo-interactive
   ```

## How It Works

### Conversation Flow

1. **Initial Call**: Demo starts with simulated calls to businesses
2. **First Message**: Tara greets the vendor (simulated)
3. **Vendor Response**: AI generates vendor's response based on business context
4. **Tara Response**: AI generates Tara's follow-up based on the conversation
5. **Repeat**: Continue until conversation completes or user takes over

### Takeover Flow

1. User clicks "Take Over" → Call enters takeover mode
2. User speaks into microphone (browser Speech Recognition API)
3. Speech is transcribed and sent to backend
4. Backend generates Tara's response using OpenAI
5. Response is converted to speech using ElevenLabs
6. User can continue the conversation naturally

### API Endpoints

**Backend:**
- `POST /api/demo/simulate-conversation` - Simulate next conversation turn
- `POST /api/demo/simulate-vendor` - Simulate vendor response
- `POST /api/elevenlabs/tts` - Text-to-speech conversion

**Frontend:**
- `POST /api/elevenlabs/tts` - Proxy to ElevenLabs (keeps API key server-side)
- `GET /api/elevenlabs/voices` - List available voices

## Voice Settings

Default ElevenLabs voice: **Rachel** (`21m00Tcm4TlvDq8ikWAM`)
- Stability: 0.5
- Similarity Boost: 0.75
- Speaker Boost: Enabled

You can change the voice ID in:
- Frontend: `src/lib/elevenlabs-client.ts`
- Backend: `backend/src/routes/elevenlabs.ts`

## Troubleshooting

### OpenAI API Errors
- Verify `OPENAI_API_KEY` is set correctly
- Check API quota and billing status

### ElevenLabs API Errors
- Verify `ELEVENLABS_API_KEY` is set correctly
- Check character usage limits

### Speech Recognition Not Working
- Ensure browser supports Web Speech API (Chrome, Edge, Safari)
- Grant microphone permissions when prompted
- Check browser console for errors

### Audio Playback Issues
- Check browser audio permissions
- Verify ElevenLabs API is responding correctly
- Check network tab for failed requests

## Next Steps

- Add more realistic business personas
- Implement conversation history persistence
- Add sentiment analysis visualization
- Support multiple languages
- Add conversation quality metrics

