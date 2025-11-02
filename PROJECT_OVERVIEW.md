# VADR (Voice Agent Deep Research) - Comprehensive Project Overview

## 📋 Executive Summary

**VADR** is a full-stack platform that enables **parallel voice calling at scale** for local research, lead qualification, and real-time information gathering. Think of it as "Google Search for phone calls" - users type a natural language query, and VADR finds businesses, makes multiple calls in parallel, and provides live transcripts and summaries.

### Key Value Proposition
- **Automated Voice Research**: Replace manual phone calling with AI-powered parallel calls
- **Real-Time Intelligence**: Get immediate answers to queries like "hair salons with same-day appointments"
- **Human-in-the-Loop**: Listen in, take over calls, or let AI handle everything automatically
- **Scalable**: Make 6+ calls simultaneously (expandable to 50+)

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Search Page  │  │  Call Grid    │  │  Summaries   │    │
│  │              │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────────────────┬───────────────────────────────┘
                             │ HTTP/SSE
┌────────────────────────────▼───────────────────────────────┐
│              Backend API (Fastify + Bun)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Search API  │  │  Call API    │  │  Twilio API   │    │
│  │  (Leads)     │  │  (Runs)      │  │  (Webhooks)  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───────────┬───────────────────┬───────────────────────────┘
            │                   │
    ┌───────▼──────┐   ┌────────▼────────┐
    │   Database   │   │  External APIs │
    │  (PostgreSQL) │   │  - Google Places│
    │              │   │  - Exa (via     │
    │              │   │    Metorial)    │
    │              │   │  - Twilio Voice │
    │              │   │  - OpenAI GPT   │
    └──────────────┘   └─────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Icons**: Lucide React
- **State Management**: React hooks (useState, useEffect)
- **Package Manager**: Bun
- **Real-Time Updates**: Server-Sent Events (SSE)

### Backend
- **Runtime**: Bun (JavaScript runtime)
- **Framework**: Fastify (lightweight web framework)
- **Database**: PostgreSQL with Prisma ORM
- **AI/ML**: OpenAI GPT-4o-mini for voice agent responses
- **Telephony**: Twilio Programmable Voice
- **Search**: Google Places API + Exa (neural search via Metorial MCP)

### Shared/Common
- **Validation**: Zod schemas for type-safe API contracts
- **Monorepo**: Workspace structure with shared packages
- **Error Tracking**: Sentry

## 📁 Project Structure

```
VADR/
├── src/                          # Frontend application
│   ├── app/
│   │   ├── page.tsx              # Main home page (search → review → calling → summary)
│   │   ├── summaries/
│   │   │   └── page.tsx          # Call summaries page
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css            # Global styles
│   ├── components/
│   │   ├── call-grid.tsx          # Grid view of parallel calls
│   │   ├── call-tile.tsx          # Individual call card component
│   │   ├── waveform.tsx           # Audio waveform visualization
│   │   └── ui/                    # shadcn/ui components
│   └── lib/
│       ├── api-client.ts         # API client with SSE support
│       ├── call-prep.ts           # Call preparation logic
│       ├── test-data.ts           # Test/mock data generator
│       └── call-style.ts          # Styling utilities
│
├── backend/                      # Backend API server
│   ├── src/
│   │   ├── index.ts               # Fastify server setup
│   │   ├── routes/
│   │   │   ├── search.ts          # Lead search endpoint
│   │   │   ├── calls.ts           # Call run management
│   │   │   ├── twilio.ts          # Twilio webhook handlers
│   │   │   └── events.ts          # SSE event stream
│   │   ├── server/
│   │   │   ├── services/
│   │   │   │   └── call-service.ts # Core call orchestration
│   │   │   └── store/
│   │   │       ├── in-memory-call-store.ts  # In-memory storage
│   │   │       └── prisma-call-store.ts    # Database storage
│   │   └── lib/
│   │       ├── agent.ts           # OpenAI agent logic
│   │       ├── twilio.ts          # Twilio client wrapper
│   │       └── transcript.ts     # Transcript utilities
│   └── prisma/
│       └── schema.prisma         # Database schema
│
└── packages/
    └── shared/                   # Shared TypeScript types
        └── src/
            └── types.ts           # Zod schemas and types
```

## 🔄 Core Workflow

### 1. Search & Lead Discovery

**User Query** → "hair salons with same-day appointments under $60"

```
1. User enters query + grants location permission
2. Frontend sends GET /api/search?q=...&lat=...&lng=...
3. Backend searches:
   - Google Places API (primary)
   - Exa neural search via Metorial (backup/enhancement)
4. Results enriched with:
   - Phone numbers
   - Ratings & reviews
   - Distance from user
   - Business descriptions
5. Return top 10 leads sorted by distance
```

### 2. Lead Review & Selection

**User Interface**:
- Displays all found leads in reviewable cards
- Checkboxes to select which businesses to call
- Shows: name, phone, rating, distance, description
- Default: all leads selected

### 3. Call Preparation

**Automatic Prep Generation**:
```typescript
{
  objective: "Speak with businesses that match 'hair salons...' to capture availability, pricing...",
  script: "1. Greet... 2. Explain research... 3. Ask about availability...",
  variables: {
    research_query: "hair salons...",
    primary_targets: "Elite Salon & Spa and Modern Barber Shop",
    top_rating: "4.8/5"
  },
  redFlags: ["No phone contact possible", ...],
  disallowedTopics: ["Making contractual promises", ...]
}
```

### 4. Parallel Call Execution

**Backend Process**:
```
1. Create Run record in database
2. For each selected lead:
   - Create Call record with state='dialing'
   - Initiate Twilio outbound call
   - Store Twilio Call SID
3. Calls proceed through states:
   dialing → ringing → connected/voicemail/failed → completed
```

**Twilio Integration**:
- Outbound calls use TwiML (Twilio Markup Language)
- Webhooks for call status updates
- Gather verb for speech-to-text
- Real-time transcript generation

### 5. Live Call Monitoring

**Frontend Real-Time Updates**:
- SSE connection to `/api/events?runId=...`
- Receives snapshot events with full run state
- Updates call tiles in real-time:
  - State changes
  - Transcript turns (word-by-word)
  - Sentiment analysis
  - Duration tracking

**User Controls**:
- **Listen**: Real-time audio monitoring
- **Take Over**: Human agent replaces AI
- **End Call**: Terminate call manually

### 6. AI Agent Conversation

**Agent Logic** (OpenAI GPT-4o-mini):
```
System Prompt:
"You are VADR, an AI sales associate calling [Business Name].
Goal: [Objective]
Script: [Flow]
Disallowed topics: [...]
Red flags: [...]"

For each human utterance:
1. Append to conversation history
2. Generate agent reply via OpenAI
3. Check for [END_CALL] signal
4. Return text for TTS (Text-to-Speech)
5. Append AI turn to transcript
```

**Call Termination**:
- Agent signals `[END_CALL]` when:
  - Information gathered
  - Lead not interested
  - Lead asks to end
  - 8+ exchanges completed

### 7. Call Completion & Summarization

**Automatic Summary Generation**:
```
- Highlights: Connection stats, ratings, best match
- Recommendation: Top lead with contact info
- Next Steps: Follow-up actions
```

**Individual Call Summaries** (new feature):
- Outcome description
- Key points extracted
- Pricing & availability (if captured)
- Transcript preview
- Sentiment analysis

## 📊 Data Models

### Core Entities

**Run** (Campaign Session)
```typescript
{
  id: string
  query: string                    // Original user query
  createdBy: string               // User identifier
  status: 'searching' | 'calling' | 'completed'
  startedAt: number              // Timestamp
  calls: Call[]                   // All calls in this run
}
```

**Call** (Individual Phone Call)
```typescript
{
  id: string
  leadId: string
  lead: Lead                      // Business information
  state: 'dialing' | 'ringing' | 'connected' | 
         'voicemail' | 'completed' | 'failed'
  startedAt?: number
  endedAt?: number
  duration: number                // Seconds
  transcript: TranscriptTurn[]   // Conversation turns
  sentiment: 'positive' | 'neutral' | 'negative'
  isListening: boolean
  isTakenOver: boolean
  extractedData?: {               // Structured data
    price?: string
    availability?: string
    notes?: string
  }
}
```

**Lead** (Business Contact)
```typescript
{
  id: string
  name: string
  phone: string
  source: string                  // 'Google Places', 'Yelp', etc.
  rating: number                  // 0-5
  reviewCount: number
  description: string
  distance?: number                // Miles from user
  confidence: number               // 0-1 match confidence
}
```

**TranscriptTurn** (Single Utterance)
```typescript
{
  id: string
  speaker: 'ai' | 'human'
  text: string
  timestamp: number
  t0_ms: number                   // Start time in call
  t1_ms: number                   // End time in call
}
```

### Database Schema (Prisma)

```prisma
model Run {
  id         String   @id
  query      String
  createdBy  String
  status     String
  startedAt  DateTime
  prep       Json?    // CallPrep object
  calls      Call[]
}

model Call {
  id               String   @id
  runId            String
  leadId           String
  leadName         String
  leadPhone        String
  state            String
  sentiment        String?
  startedAt        DateTime?
  endedAt          DateTime?
  durationSeconds  Int?
  twilioCallSid    String?  @unique
  transcript       TranscriptTurn[]
}

model TranscriptTurn {
  id        String   @id
  callId    String
  speaker   String   // 'ai' | 'human'
  text      String
  timestamp DateTime
  t0Ms      Int?
  t1Ms      Int?
}
```

## 🔌 API Endpoints

### Frontend → Backend

**GET `/api/search`**
- Query parameters: `q`, `lat`, `lng`
- Returns: `Lead[]`
- Purpose: Find businesses matching query near location

**POST `/api/start-calls`**
- Body: `StartCallsRequest` (query, leads, prep, createdBy)
- Returns: `StartCallsResponse` (runId, run)
- Purpose: Initiate parallel call campaign

**POST `/api/calls/:callId`**
- Body: `CallActionRequest` (action: 'listen' | 'takeover' | 'end', value?: boolean)
- Purpose: Control individual call (listen, take over, end)

**GET `/api/events`** (Server-Sent Events)
- Query parameters: `runId`
- Streams: `CallEvent` snapshots
- Purpose: Real-time run state updates

### Twilio → Backend

**POST `/api/twilio/outbound`**
- Query parameters: `runId`, `callId`
- Returns: TwiML XML
- Purpose: Twilio callback when call is answered

**POST `/api/twilio/gather`**
- Query parameters: `runId`, `callId`
- Body: Speech result from Twilio
- Purpose: Process human speech, generate AI response

**POST `/api/twilio/status`**
- Query parameters: `runId`, `callId`
- Body: Twilio call status update
- Purpose: Update call state (ringing, answered, completed)

## 🎨 User Interface

### Pages

**1. Home/Search Page** (`/`)
- **Stage 1: Search**
  - Logo and branding (TARA)
  - Location permission request
  - Natural language search input
  - Example query suggestions
  - Test call button
  - **View Call Summaries** button (new)

- **Stage 2: Review**
  - List of found leads with checkboxes
  - Lead details: name, phone, rating, distance
  - Edit search / Start calls buttons

- **Stage 3: Calling**
  - Live call grid (responsive layout)
  - Real-time call tiles with:
    - State badges
    - Waveform visualization
    - Transcript stream
    - Control buttons
  - Run query display

- **Stage 4: Summary**
  - Run-level highlights
  - Recommendation
  - Next steps
  - Link back to call grid

**2. Summaries Page** (`/summaries`)
- Statistics dashboard:
  - Total calls
  - Completed count
  - Total duration
  - Average rating
- Individual call summaries:
  - Business information
  - Outcome description
  - Key points
  - Extracted data (price, availability)
  - Transcript preview
  - Sentiment & state badges

### Components

**CallGrid**: Manages grid of call tiles, SSE connection, call controls
**CallTile**: Individual call card with transcript, controls, state
**Waveform**: Animated audio waveform visualization
**PrepPanel**: Call preparation display (currently hidden/minimal)

## 🔧 Key Features

### 1. Parallel Calling
- Makes multiple calls simultaneously (6+ in parallel)
- Each call operates independently
- Real-time state tracking per call

### 2. Live Transcripts
- Word-by-word transcript updates via SSE
- Color-coded by speaker (AI vs Human)
- Scrollable transcript view in call tiles

### 3. Human-in-the-Loop Controls
- **Listen**: Real-time audio monitoring without speaking
- **Take Over**: Human agent replaces AI mid-call
- **End Call**: Manual termination

### 4. AI Agent Intelligence
- Context-aware conversations
- Script adherence
- Red flag detection
- Automatic call termination
- Sentiment analysis

### 5. Lead Enrichment
- Google Places API for business data
- Exa neural search for discovery
- Distance calculation
- Rating aggregation

### 6. Test Data Generation
- `generateTestCalls()` function creates mock calls
- Full transcripts for benchmarking
- Multiple scenarios (success, voicemail, failed)
- Useful when real calls aren't working

## 🔐 Security & Privacy

### Current State (Demo)
- No user authentication
- No PII storage in demo mode
- CORS protection on backend

### Production Requirements
- User authentication & authorization
- GDPR/CCPA compliance
- Call recording consent management
- Data encryption at rest
- Secure API keys management

## 🚀 Deployment

### Frontend
- Next.js production build
- Static site generation where possible
- Edge deployment (Vercel, Netlify)
- Environment variables:
  - `NEXT_PUBLIC_BACKEND_URL`
  - `METORIAL_API_KEY`

### Backend
- Bun runtime
- Fastify server
- PostgreSQL database
- Environment variables:
  - `PORT`, `HOST`
  - `DATABASE_URL`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - `OPENAI_API_KEY`
  - `METORIAL_API_KEY`
  - `GOOGLE_PLACES_API_KEY`
  - `PUBLIC_BASE_URL`

### Infrastructure
- Database: PostgreSQL (Railway, PlanetScale, etc.)
- Telephony: Twilio Programmable Voice
- Monitoring: Sentry error tracking
- Search: Google Places API + Exa (via Metorial)

## 📈 Roadmap & Future Enhancements

### Immediate
- ✅ Call summaries page
- ✅ Test data generation
- ✅ Manual navigation to summaries
- [ ] Real telephony integration fixes
- [ ] Live transcription improvements

### Short-term
- [ ] User authentication
- [ ] Call recording storage
- [ ] CRM integrations (Salesforce, HubSpot)
- [ ] Email/SMS follow-up automation
- [ ] Advanced analytics dashboard

### Long-term
- [ ] Pro plan (50+ parallel calls)
- [ ] Memory layer for business facts
- [ ] Multi-language support
- [ ] Voice cloning for brand consistency
- [ ] A/B testing for scripts
- [ ] Predictive lead scoring

## 🤝 Integrations

### Current
- **Twilio**: Voice calls and speech recognition
- **OpenAI**: AI agent conversation generation
- **Google Places**: Business search and enrichment
- **Exa** (via Metorial): Neural web search
- **Sentry**: Error tracking

### Potential
- **COVAL**: Voice agent evaluation
- **Captain (YC F25)**: Business intelligence & data enrichment
- **Unsilod AI (YC F25)**: Advanced NLP and intent detection
- **Nivara (YC F25)**: Workflow automation platform

## 📝 Development Workflow

### Setup
```bash
# Install dependencies
bun install

# Frontend dev server
bun run dev

# Backend dev server
cd backend && bun run dev

# Build shared package
bun run build:shared
```

### Testing
```bash
# Type checking
bun run lint

# Production build verification
bun run verify

# Backend test scripts
cd backend
bun run tsx scripts/test-call-flow.ts
bun run node scripts/test-exa-search.js
```

### Database
```bash
# Generate Prisma client
cd backend && bunx prisma generate

# Run migrations
bunx prisma migrate dev

# View database
bunx prisma studio
```

## 🐛 Known Issues & Limitations

1. **Call Functionality**: Real calls may not work (use test data for benchmarking)
2. **No Authentication**: Demo mode only
3. **Limited Scaling**: Currently supports ~6 parallel calls
4. **Transcript Quality**: Depends on Twilio speech recognition accuracy
5. **Single Language**: English only
6. **No Call Recording**: Transcripts only, no audio storage

## 📚 Key Files Reference

### Frontend Entry Points
- `src/app/page.tsx` - Main application flow
- `src/app/summaries/page.tsx` - Call summaries view
- `src/lib/api-client.ts` - API communication layer

### Backend Entry Points
- `backend/src/index.ts` - Server setup
- `backend/src/routes/` - API route handlers
- `backend/src/server/services/call-service.ts` - Core call logic

### Shared Types
- `packages/shared/src/types.ts` - Zod schemas and TypeScript types

---

**Status**: MVP/Demo - Production-ready features with demo limitations
**License**: MIT
**Built with**: Next.js, Fastify, Bun, Twilio, OpenAI, Google Places

