# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VADR (Voice Agent Deep Research) is a platform for parallel voice calling at scale. It enables automated outbound calls for local research, lead qualification, and real-time information gathering using Twilio telephony and OpenAI's Realtime API.

**Key capabilities:**
- Search for businesses via Google Places API
- Initiate up to 6 parallel outbound calls via Twilio
- AI voice agents powered by OpenAI Realtime API
- Live transcript streaming to frontend via SSE
- Real-time call controls (listen, takeover, end)

## Monorepo Architecture

This is a **Bun workspace monorepo** with three packages:

```
packages/
├── backend/     # Fastify API (Twilio webhooks, call orchestration)
├── frontend/    # Next.js 15 app (search UI, live call grid)
└── shared/      # Zod schemas and TypeScript types (source of truth)
```

**Critical monorepo principles:**
- **Never create duplicate types** - all shared types live in `packages/shared/src/types.ts`
- **Always import from `@vadr/shared`** - backend and frontend must import shared types from the workspace package, not from relative paths
- **Build order matters** - shared package must build before backend/frontend (handled automatically in scripts)

## Development Commands

### From Monorepo Root

```bash
# Install all workspace dependencies
bun install

# Run backend dev server (http://localhost:3001)
bun run dev:backend

# Run frontend dev server (http://localhost:3000)
bun run dev:frontend

# Build everything (backend + frontend)
bun run build

# Build individual packages
bun run build:backend
bun run build:frontend
```

### Backend-Specific (from packages/backend)

```bash
# Development with hot-reload
bun run dev

# Build TypeScript to dist/
bun run build

# Type check without emitting
bun run typecheck

# Generate Prisma client (after schema changes)
bunx prisma generate

# Run production build
bun run start
```

### Frontend-Specific (from packages/frontend)

```bash
# Development with Turbopack
bun run dev

# Build for production
bun run build

# Type check + lint + build (pre-deploy)
bun run verify

# Format with Biome
bunx biome format --write
```

### Shared Package (from packages/shared)

```bash
# Build TypeScript to dist/
bun run build
```

## Core Data Flow

### 1. Search → Call Initialization
- Frontend sends query to `/api/search` (Google Places API)
- User selects leads and configures call prep (objective, script, variables)
- Frontend posts to `/api/start-calls` with leads + prep
- Backend creates VADRRun, initiates Twilio calls, returns runId

### 2. Twilio Call Flow
```
Twilio dials number
  → /api/twilio/outbound (returns TwiML with <Gather> for voice input)
  → User speaks / AI speaks
  → /api/twilio/gather (processes speech, generates AI reply via OpenAI)
  → /api/twilio/status (updates call state: completed/failed/voicemail)
```

### 3. Real-Time Updates (SSE)
- Frontend opens EventSource to `/api/events?runId={runId}`
- Backend streams `CallEvent` snapshots with updated transcripts and state
- Frontend renders live call grid with transcripts, sentiment, state

### 4. Call Controls
- Listen: `POST /api/calls/{callId}` with `{action: "listen", value: true}`
- Takeover: `POST /api/calls/{callId}` with `{action: "takeover", value: true}`
- End: `POST /api/calls/{callId}` with `{action: "end"}`

## Key Architectural Patterns

### Type Safety with Zod
All request/response payloads are validated with Zod schemas from `@vadr/shared`:
- `startCallsRequestSchema` - validates call initiation
- `callActionSchema` - validates call control actions
- `callEventSchema` - defines SSE event structure

Backend routes parse with `.parse()` and throw on validation errors.

### State Management
- **Backend**: `CallStore` interface with two implementations:
  - `InMemoryCallStore` (default, ephemeral)
  - `PrismaCallStore` (persistent, requires DATABASE_URL)
- **Frontend**: Server-Sent Events (SSE) for reactive state updates, no client-side state library

### Call Service Pattern
`packages/backend/src/server/services/call-service.ts` is the core orchestrator:
- `startRun()` - creates run, initiates Twilio calls
- `handleGather()` - processes user speech, generates AI reply
- `handleStatus()` - updates call state based on Twilio callbacks
- `setListening()`, `setTakeOver()`, `endCall()` - call controls

### AI Agent Integration
`packages/backend/src/lib/agent.ts` wraps OpenAI API:
- `generateAgentReply()` - takes conversation history + call prep, returns AI response
- Uses `VOICE_AGENT_MODEL` env var (default: gpt-4o-mini)
- Conversation history stored in CallSession for context

### Twilio Integration
`packages/backend/src/lib/twilio.ts`:
- `getTwilioClient()` - singleton Twilio client
- `generateOutboundTwiML()` - creates initial TwiML for call
- `generateGatherTwiML()` - creates TwiML with AI speech + voice input gather

## Environment Variables

### Backend (packages/backend/.env)
**Required:**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `DATABASE_URL` (PostgreSQL connection string)

**Optional:**
- `PUBLIC_BASE_URL` - for Twilio webhooks (Railway deployment URL)
- `FRONTEND_URL` - for CORS (defaults to localhost, auto-allows *.vercel.app)
- `VOICE_AGENT_MODEL` - OpenAI model (default: gpt-4o-mini)
- `CAPTAIN_API_KEY`, `CAPTAIN_ORGANIZATION_ID` - for call enrichment

### Frontend (packages/frontend/.env.local)
- `NEXT_PUBLIC_BACKEND_URL` - backend API URL (http://localhost:3001 or Railway URL)

## Deployment

### Backend → Railway
- Dockerfile: `packages/backend/Dockerfile` (multi-stage build)
- Build context: monorepo root (entire `packages/` directory)
- Configuration: `railway.toml` at root
- **Important:** Dockerfile must use Bun 1.2+ to match lockfile format

Key Dockerfile steps:
1. Copy root package.json + all workspace package.jsons
2. Run `bun install --frozen-lockfile`
3. Copy entire `packages/` directory
4. Generate Prisma client with `bunx prisma generate --schema=./packages/backend/prisma/schema.prisma`
5. Build backend with `bun run --cwd packages/backend build`

### Frontend → Vercel
- Root Directory: `packages/frontend`
- Install Command: `bun install`
- Build Command: `bun run build` (automatically builds shared package first)
- Output Directory: `.next`

## Common Patterns & Gotchas

### Adding New Shared Types
1. Define Zod schema in `packages/shared/src/types.ts`
2. Export from `packages/shared/src/index.ts`
3. Run `bun run --cwd packages/shared build`
4. Import in backend/frontend with `import { TypeName } from '@vadr/shared'`

### Modifying Call Data Structure
If you add fields to `Call`, `Lead`, or other shared types:
1. Update Zod schema in `packages/shared/src/types.ts`
2. Update backend store implementations (`in-memory-call-store.ts`, `prisma-call-store.ts`)
3. Update Prisma schema if using database persistence
4. Update frontend components that render the data

### Twilio Webhook Development
- Webhooks require public URL (use ngrok for local dev)
- Set `PUBLIC_BASE_URL` env var to ngrok URL
- Update Twilio console webhook URLs to point to ngrok
- Webhook paths: `/api/twilio/outbound`, `/api/twilio/gather`, `/api/twilio/status`

### SSE Event Streaming
Backend uses `fastify-sse-v2` (custom fork) for SSE:
- `callService.subscribe(runId, send)` registers callback
- Send events with `send({ type: 'snapshot', run })`
- Frontend auto-reconnects on connection drop

## Testing

No formal test suite exists yet. Manual testing flow:
1. Start backend: `bun run dev:backend`
2. Start frontend: `bun run dev:frontend`
3. Open http://localhost:3000
4. Search for businesses (e.g., "hair salons near me")
5. Configure call prep, select leads
6. Start calls and monitor transcripts

For Twilio webhook testing:
1. Use ngrok: `ngrok http 3001`
2. Set `PUBLIC_BASE_URL=https://your-ngrok-url.ngrok.io`
3. Update Twilio console with ngrok webhook URLs
4. Make test call

## Database Schema (Prisma)

Located at `packages/backend/prisma/schema.prisma`. Core models:
- `Run` - call research session
- `Lead` - business contact
- `Call` - individual call record
- `TranscriptTurn` - single turn in conversation

After schema changes:
```bash
bunx prisma generate           # Regenerate Prisma client
bunx prisma migrate dev        # Create and apply migration
```

## Important File Paths

- Type definitions: `packages/shared/src/types.ts`
- Call orchestration: `packages/backend/src/server/services/call-service.ts`
- Twilio webhooks: `packages/backend/src/routes/twilio.ts`
- AI agent logic: `packages/backend/src/lib/agent.ts`
- Call store interface: `packages/backend/src/server/store/types.ts`
- Frontend call grid: `packages/frontend/src/components/call-grid.tsx`
- SSE event streaming: `packages/backend/src/routes/events.ts`
