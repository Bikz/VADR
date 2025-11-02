# VADR - Voice Agent Deep Research

A Google-like search interface for parallel voice research. Type a prompt → VADR finds numbers → calls in parallel with live transcripts and takeover controls.

![VADR Screenshot](https://img.shields.io/badge/Status-Demo-purple?style=for-the-badge)

## 🎯 What is VADR?

VADR (Voice Agent Deep Research) is a platform that enables **parallel voice calling at scale** for local research, lead qualification, and real-time information gathering.

### Core Use Cases

1. **Outreach @ Scale**: Cold/warm outbound sales discovery
2. **Local Operations**: Bookings, quotes, availability checks
3. **Field Research**: Verify inventory, policies, pricing that the web doesn't list

### How It Works

```
User Query → Web Search → Find Phone Numbers → 6 Parallel Calls → Live Transcripts → Results
```

## ✨ Features

### Live Call Grid
- **6 parallel calls** (Basic plan) with real-time state tracking
- Call states: `Dialing` → `Ringing` → `Connected` → `Voicemail` → `Completed`
- Live word-by-word transcripts streaming to UI
- Visual waveform indicators

### Interactive Controls
- **Listen**: Monitor calls in real-time
- **Take Over**: Mute AI and join the call yourself
- **Barge-in**: Interrupt and guide the conversation
- **End Call**: Terminate at any time

### Call Preparation Panel
- Objective setting
- Conversation script flow
- Dynamic variables
- Red flags monitoring
- Disallowed topics guardrails

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Pre-deploy sanity check (typecheck + lint + production build)
bun run verify

# Build for production
bun run build
```

Visit `http://localhost:3000` and try an example query!

## 🔧 Telephony Setup (Track 1)

1. Install the new dependencies (Twilio + OpenAI SDKs):

   ```bash
   bun install
   ```

2. Create a `.env.local` and provide the required credentials:

   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
   OPENAI_API_KEY=sk-...
   PUBLIC_BASE_URL=https://your-ngrok-or-production-host
   # Optional overrides
   VOICE_AGENT_MODEL=gpt-4o-mini
   TWILIO_VOICE_NAME=Polly.Joanna
   ```

   `PUBLIC_BASE_URL` must be reachable by Twilio (use Ngrok during local development).

3. Give the outbound number call permissions in the Twilio console (Voice > Settings > Geo Permissions) and verify the caller ID if you are using Trial credentials.

4. Start the dev server: `bun run dev` and expose it via Ngrok so Twilio can reach the `/api/twilio/*` webhooks.

5. Initiate a run from the UI. The dashboard now:

   - Calls `/api/start-calls` which spins up real Twilio outbound calls into a gather-loop powered by GPT + Twilio TTS.
   - Streams call state + transcripts over Server-Sent Events (`/api/events?runId=...`) so tiles update in near-real time.
   - Sends transcript turns to the LLM, generates agent replies, and plays them back with Twilio’s `<Gather>` loop.

6. Use the “Listen” and “Take Over” toggles to flag intent to monitor/join. (The UI state syncs server-side; injecting the user audio leg via Twilio Client is queued in TODOs below.)

### Service architecture

- **CallService (`src/server/services/call-service.ts`)** owns Twilio orchestration, LLM turns, and state transitions.
- **CallStore (`src/server/store`)** currently uses an in-memory implementation; swap in Redis/Postgres later without touching the routes.
- Next.js API routes (`/api/start-calls`, `/api/twilio/*`, `/api/events`, `/api/calls/[id]`) now just delegate to the service layer so migrating to Fastify or workers is a matter of reusing the same modules.

### Manual test flow

1. Add your mobile number as one of the mock leads so you can answer.
2. Run `bun run dev`, tunnel with Ngrok, and update `PUBLIC_BASE_URL` to the tunnel URL.
3. From the dashboard, run a query, keep the default leads selected, and click “Go”.
4. When you answer the call, speak a few short phrases. Watch the transcript panel update per turn.
5. Confirm the agent replies using Twilio TTS and the tile state transitions to `completed` when you hang up.

### Pre-deploy checks

- `bun run verify` runs type-checking, lint, and a production build locally so you can catch the same errors Vercel will surface before pushing.
- If you only need the quick validations, `bun run lint` mirrors the checks Next.js performs during `next build`.

### Remaining TODOs / Next steps

- Switch from the `<Gather>` loop to full-duplex Twilio Media Streams + Deepgram for word-by-word transcripts.
- Wire the “Take Over” control into a Twilio Voice Client/WebRTC participant so the operator can actually barge in.
- Persist run + call state to durable storage (currently in-memory).
- Add analytics + guardrail evaluation hooks (e.g., COVAL) before production rollout.

## 📋 Example Queries

- "Find 5 salons near me with same-day appointments under $60"
- "Get quotes from 3 drywall contractors with next-day availability"
- "Find massage therapists available today at 4 PM within 2 miles"
- "Contact barbershops that are open now and accept walk-ins"
- "Find tailors offering same-week alterations under $50"

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **UI Components**: shadcn/ui with custom styling
- **Styling**: Tailwind CSS with dark theme
- **Icons**: Lucide React
- **Package Manager**: Bun

## 🎨 Design Philosophy

- **Dark theme** optimized for extended use
- **Brand color**: `#6C5CE7` (purple accent)
- **Minimal motion**: 150-200ms transitions
- **Accessible**: High contrast ratios
- **Responsive**: Mobile, tablet, desktop support

## 🧩 Architecture (MVP)

### Current Implementation (Demo)
- Mock data generation for realistic simulation
- Simulated call state transitions
- Live transcript streaming simulation
- WebSocket-ready architecture

### Production Architecture
```
┌─────────────┐
│   Next.js   │  Frontend (Edge-first)
│   Frontend  │
└──────┬──────┘
       │
┌──────▼──────┐
│  Search &   │  SerpAPI, Tavily, Google Places
│ Prospecting │  Yelp, Yellow Pages APIs
└──────┬──────┘
       │
┌──────▼──────┐
│   Parallel  │  Twilio Programmable Voice
│   Dialer    │  Conference + WebSocket bots
└──────┬──────┘
       │
┌──────▼──────┐
│    Voice    │  LLM + TTS loop
│    Agent    │  MCP tools via Metorial
│   Runtime   │  Evals via COVAL
└──────┬──────┘
       │
┌──────▼──────┐
│   Memory    │  CAPTON / Mem0 / Supermemory
│    Layer    │  Persist business facts
└─────────────┘
```

## 🤝 Hackathon Integrations

### COVAL (Voice Agent Evals)
Use COVAL to simulate synthetic callers with different accents and intents against your prompt trees to tune handoffs and guardrails before real calls.

**Integration Point**: Pre-deployment testing of AI agent responses

### Metorial (MCP Platform)
Metorial provides an MCP-based integration layer with SDKs and a catalog of MCP servers. Plug tools without custom glue (OAuth, tracing, per-user isolation).

**Integration Point**: Attach SerpAPI, Tavily, Yelp, Google Places, Twilio via MCP

## 📊 Data Model

```typescript
// Core entities
- Run: Research session with query and calls
- Lead: Business/person with phone number
- Call: Individual call with state and transcript
- Turn: Single speaker turn in transcript
- Memory: Extracted facts about businesses
```

## 🔒 Security & Privacy

- No PII stored in demo mode
- Production requires user authentication
- GDPR-compliant data handling
- Call recording opt-in required
- Consent management built-in

## 🛣️ Roadmap

- [ ] Real telephony integration (Twilio)
- [ ] Live transcription (Deepgram/Gladia)
- [ ] Voice agent runtime (LLM + TTS)
- [ ] Memory persistence layer
- [ ] User authentication
- [ ] Call analytics dashboard
- [ ] Export to CRM integrations
- [ ] Pro plan (50 parallel calls)

## 📄 License

MIT License - Built for hackathon demo purposes

## 🙏 Acknowledgments

Built with support from:
- **COVAL** - AI agent evaluation and simulation
- **Metorial** - MCP platform for tool integrations

---

**Note**: This is a demo/MVP implementation. Production use requires proper telephony setup, compliance checks, and user consent flows.
