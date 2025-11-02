# VADR Backend

Fastify-based backend server for VADR voice calling platform.

## Quick Start

### Local Development

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Start development server
bun run dev
```

Server will be available at `http://localhost:3001`

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required variables:
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number
- `OPENAI_API_KEY` - OpenAI API key
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_PLACES_API_KEY` - Google Places API key

Optional variables:
- `FRONTEND_URL` or `FRONTEND_URLS` - Comma-separated list of allowed frontend URLs for CORS (defaults to `http://localhost:3000`). Vercel domains (`*.vercel.app`, `*.vercel.sh`) are automatically allowed.
- `PUBLIC_BASE_URL` - Public URL of the backend (used for Twilio webhooks)
- `CAPTAIN_API_KEY` - Captain API key (for after-call enrichment, default: `cap_dev_ntWWrmra24fjcsBgTrtyCeFbZqiEXzBL`)
- `CAPTAIN_ORGANIZATION_ID` - Captain organization ID (default: `armaanb7@ucla.edu`)

### Production Build

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## Deploy to Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize project:
```bash
railway init
```

4. Set environment variables:
```bash
railway variables set TWILIO_ACCOUNT_SID=your_value
railway variables set TWILIO_AUTH_TOKEN=your_value
railway variables set TWILIO_PHONE_NUMBER=your_value
railway variables set OPENAI_API_KEY=your_value
railway variables set DATABASE_URL=your_value
railway variables set GOOGLE_PLACES_API_KEY=your_value
railway variables set TWILIO_VOICE_NAME=Google.en-US-Neural2-F
railway variables set VOICE_AGENT_MODEL=gpt-4o-mini
railway variables set NODE_ENV=production
```

5. Deploy:
```bash
railway up
```

6. Get your public URL:
```bash
railway domain
```

7. Update environment variables with your Railway URL and frontend URL:
```bash
railway variables set PUBLIC_BASE_URL=https://your-app.railway.app
railway variables set FRONTEND_URL=https://vadr-five.vercel.app
```

**Note**: The backend automatically allows all Vercel domains (`*.vercel.app`, `*.vercel.sh`) for CORS, so you don't need to set `FRONTEND_URL` if you're only deploying to Vercel. However, setting it explicitly can help with logging and is recommended.

## API Routes

- `GET /health` - Health check
- `POST /api/start-calls` - Start new call run
- `GET /api/search` - Search for businesses
- `GET /api/events` - SSE stream for call updates
- `POST /api/calls/:callId` - Control call (listen/takeover/end)
- `GET /api/calls/:callId` - Get call details
- `POST /api/twilio/gather` - Twilio gather webhook
- `GET/POST /api/twilio/outbound` - Twilio outbound call webhook
- `POST /api/twilio/status` - Twilio status callback

## Architecture

```
backend/
├── src/
│   ├── index.ts           # Main server entry
│   ├── routes/            # API route handlers
│   │   ├── twilio.ts      # Twilio webhooks
│   │   ├── calls.ts       # Call management
│   │   ├── search.ts      # Business search
│   │   └── events.ts      # SSE streaming
│   ├── server/            # Business logic
│   │   ├── services/      # Call service
│   │   └── store/         # Data persistence
│   ├── lib/               # Utilities
│   │   ├── agent.ts       # OpenAI agent
│   │   ├── twilio.ts      # Twilio client
│   │   ├── env.ts         # Environment config
│   │   └── db.ts          # Database client
│   └── types/             # TypeScript types
└── prisma/
    └── schema.prisma      # Database schema
```

## Development Tips

- Use `bun run dev` for hot-reloading during development
- Check logs with `railway logs` after deployment
