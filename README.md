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

## 🏗️ Monorepo Structure

VADR is organized as a Bun workspace monorepo:

```
VADR/
├── packages/
│   ├── backend/       # Fastify API (deployed to Railway)
│   ├── frontend/      # Next.js app (deployed to Vercel)
│   └── shared/        # Shared Zod schemas and types
├── railway.toml       # Railway deployment config
└── package.json       # Workspace configuration
```

## 🚀 Quick Start

### Prerequisites

Install [Bun](https://bun.sh) (v1.1.34 or higher):
```bash
curl -fsSL https://bun.sh/install | bash
```

### 1. Install Dependencies (Monorepo Root)

```bash
# Install all workspace dependencies
bun install
```

This installs dependencies for all packages (backend, frontend, shared).

### 2. Set Up Environment Variables

**Frontend** (`packages/frontend/.env.local`):
```bash
cd packages/frontend
cp .env.example .env.local
# Edit and add:
# NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**Backend** (`packages/backend/.env`):
```bash
cd packages/backend
cp .env.example .env
# Fill in TWILIO_*, OPENAI_API_KEY, DATABASE_URL, GOOGLE_PLACES_API_KEY
```

### 3. Run Development Servers

**Terminal 1 - Backend:**
```bash
# From monorepo root
bun run dev:backend
# Server runs at http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
# From monorepo root
bun run dev:frontend
# Frontend runs at http://localhost:3000
```

### 4. Test the Application

Visit `http://localhost:3000` and try an example query!

### Environment Variables Reference

**Frontend** (`packages/frontend/.env.local`):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**Backend** (`packages/backend/.env`):
```env
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
OPENAI_API_KEY=...
VOICE_AGENT_MODEL=gpt-4o-mini
PUBLIC_BASE_URL=https://your-backend.railway.app
GOOGLE_PLACES_API_KEY=...
FRONTEND_URL=http://localhost:3000  # Optional for CORS
```

See [DEPLOY.md](./DEPLOY.md) for complete deployment instructions.

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

## 🧩 Architecture

### Current Implementation

```
┌─────────────────────┐
│   Next.js Frontend  │  Vercel (packages/frontend)
│   - Search UI       │
│   - Live call grid  │
│   - SSE streaming   │
└──────────┬──────────┘
           │ HTTPS/SSE
           ▼
┌─────────────────────┐
│  Fastify Backend    │  Railway (packages/backend)
│  - Google Places    │
│  - Twilio webhooks  │
│  - Call orchestration
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐   ┌──────────┐
│ Twilio │   │ OpenAI   │
│ Voice  │   │ Realtime │
└────────┘   └──────────┘
```

**Key Features:**
- **Monorepo**: Shared types via `packages/shared` with Zod schemas
- **Real-time**: SSE streaming for live transcripts and call state updates
- **Telephony**: Twilio Programmable Voice for actual phone calls
- **AI Agent**: OpenAI Realtime API for voice conversations
- **Persistence**: PostgreSQL via Prisma for call history

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

**Implemented:**
- ✅ Twilio telephony integration
- ✅ OpenAI Realtime API for voice agent
- ✅ Live transcription streaming
- ✅ PostgreSQL persistence (Prisma)
- ✅ Monorepo structure with shared types
- ✅ Call orchestration and state management
- ✅ Google Places API for business search

**Planned:**
- [ ] User authentication & multi-tenancy
- [ ] Call analytics dashboard
- [ ] Export to CRM (Salesforce, HubSpot)
- [ ] Enhanced memory layer (conversation context)
- [ ] Call recording playback
- [ ] Pro plan (50+ parallel calls)
- [ ] WebSocket support for conference calling

## 📄 License

MIT License

---

**Note**: Production use requires proper telephony setup, compliance checks, and user consent flows.
