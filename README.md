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

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your Metorial API key:
# METORIAL_API_KEY=your-metorial-api-key-here

# Run development server
bun run dev

# Pre-deploy sanity check (typecheck + lint + production build)
bun run verify

# Generate Prisma client after schema changes
bun run prisma:generate

# Push schema to PlanetScale/Neon when connected
bun run prisma:push

# Build for production
bun run build
```

Visit `http://localhost:3000` and try an example query!

### Environment Variables

Create a `.env.local` file in the root directory with:

```env
METORIAL_API_KEY=your-metorial-api-key-here
```

Get your Metorial API key from: https://metorial.com/

**Note**: This project uses Exa (neural web search) via Metorial's MCP platform. Metorial provides an integration layer that connects to Exa and other search services.

**Important**: You must configure your Exa API key in your Metorial deployment settings. Go to your Metorial dashboard, find the Exa deployment (ID: `svd_0mhhcb7z0wvg34K6xJugat`), and add your Exa API key there. The Exa API key cannot be passed via environment variables - it must be configured in the Metorial deployment.

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
