# Backend Migration Guide

This document explains the migration from Next.js API routes to a dedicated Fastify backend.

## Why We Migrated

### Problems with Vercel Serverless

1. **10-Second Timeout on Free Tier** - Voice calls with OpenAI API often took 10-15 seconds, causing "application error" hangups
2. **No Persistent Connections** - SSE streaming was limited, WebSocket support for conference calling was impossible
3. **Cold Starts** - Twilio webhooks experienced delays from function warm-up
4. **Cost at Scale** - Pro plan ($20/month) only increased timeout to 60s

### Benefits of Fastify Backend

✅ **No Timeouts** - Voice calls can run for minutes without interruption
✅ **Better Performance** - No cold starts, persistent database connections
✅ **WebSocket Ready** - Can implement conference calling and live audio streaming
✅ **Cost Effective** - Railway starts at $5/month with no execution limits
✅ **Better Debugging** - Real server logs, can SSH in for troubleshooting

## Architecture Changes

### Before (Next.js Serverless)
```
Frontend (Vercel)
├── pages/
└── app/api/          ← All routes here (10s timeout)
    ├── twilio/
    ├── start-calls/
    └── events/
```

### After (Fastify Backend)
```
Frontend (Vercel)          Backend (Railway)
├── pages/                 ├── routes/
└── components/            │   ├── twilio.ts
                           │   ├── calls.ts
                           │   ├── search.ts
                           │   └── events.ts
                           ├── server/
                           │   ├── services/
                           │   └── store/
                           └── lib/
```

## What Was Migrated

### 1. API Routes
- `src/app/api/twilio/*` → `backend/src/routes/twilio.ts`
- `src/app/api/start-calls` → `backend/src/routes/calls.ts`
- `src/app/api/search` → `backend/src/routes/search.ts`
- `src/app/api/events` → `backend/src/routes/events.ts`
- `src/app/api/calls/[callId]` → `backend/src/routes/calls.ts`

### 2. Server Code (Copied as-is)
- `src/server/` → `backend/src/server/` (services, stores)
- `src/lib/` → `backend/src/lib/` (utilities)
- `src/types/` → `backend/src/types/` (TypeScript types)
- `prisma/` → `backend/prisma/` (database schema)

### 3. Code Changes
- Next.js `NextRequest` → Fastify `FastifyRequest`
- `NextResponse.json()` → `reply.send()`
- `new Response()` → `reply.code().send()`
- Route params from URL → Fastify params/query

## Deployment Steps

### 1. Deploy Backend to Railway

```bash
cd backend

# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Set environment variables
railway variables set TWILIO_ACCOUNT_SID=your_value
railway variables set TWILIO_AUTH_TOKEN=your_value
railway variables set TWILIO_PHONE_NUMBER=your_value
railway variables set OPENAI_API_KEY=your_value
railway variables set DATABASE_URL=your_postgres_url
railway variables set GOOGLE_PLACES_API_KEY=your_value
railway variables set TWILIO_VOICE_NAME=Google.en-US-Neural2-F
railway variables set VOICE_AGENT_MODEL=gpt-4o-mini
railway variables set NODE_ENV=production
railway variables set PORT=3001

# Deploy
railway up

# Get your public URL
railway domain
# Example output: https://vadr-backend-production.up.railway.app
```

### 2. Update Backend Environment

After getting your Railway URL:

```bash
# Set PUBLIC_BASE_URL to your Railway domain
railway variables set PUBLIC_BASE_URL=https://your-app.railway.app

# Set FRONTEND_URL to your Vercel domain
railway variables set FRONTEND_URL=https://vadr-five.vercel.app
```

### 3. Update Twilio Webhooks

Go to Twilio Console and update your webhook URLs:

**Before:**
```
Answer URL: https://vadr-five.vercel.app/api/twilio/outbound
Status Callback: https://vadr-five.vercel.app/api/twilio/status
```

**After:**
```
Answer URL: https://your-railway-app.railway.app/api/twilio/outbound
Status Callback: https://your-railway-app.railway.app/api/twilio/status
```

### 4. Update Frontend Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```bash
# Add new variable
NEXT_PUBLIC_BACKEND_URL=https://your-railway-app.railway.app
```

Then redeploy your frontend.

## Frontend Changes Needed

### Update API Calls

Replace all `/api/*` calls with `${BACKEND_URL}/api/*`:

**Before:**
```typescript
const response = await fetch('/api/start-calls', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

**After:**
```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const response = await fetch(`${BACKEND_URL}/api/start-calls`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

### Update SSE Connection

**Before:**
```typescript
const eventSource = new EventSource(`/api/events?runId=${runId}`);
```

**After:**
```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const eventSource = new EventSource(`${BACKEND_URL}/api/events?runId=${runId}`);
```

## Local Development

### Terminal 1: Backend
```bash
cd backend
bun run dev
# Server at http://localhost:3001
```

### Terminal 2: Frontend
```bash
cd ..
bun run dev
# Frontend at http://localhost:3000
```

### Testing Locally

1. Make sure `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` in frontend `.env.local`
2. Use ngrok to expose backend for Twilio webhooks:
   ```bash
   ngrok http 3001
   ```
3. Update `PUBLIC_BASE_URL` in `backend/.env` to ngrok URL
4. Restart backend

## Rollback Plan

If something goes wrong, you can rollback:

1. Remove `NEXT_PUBLIC_BACKEND_URL` from Vercel
2. Frontend will use original `/api` routes
3. Redeploy Vercel to restore serverless functions

## Next Steps After Migration

1. **Remove duplicate code** - Delete `src/app/api/*` routes from frontend (keep for rollback initially)
2. **Optimize** - Add Redis caching, WebSocket support
3. **Monitor** - Set up Sentry for backend error tracking
4. **Scale** - Add more Railway instances if needed

## Troubleshooting

### Backend not responding
```bash
railway logs
```

### CORS errors
Check `FRONTEND_URL` in Railway matches your Vercel URL exactly

### Twilio webhooks failing
Verify `PUBLIC_BASE_URL` in Railway is set to your Railway domain

### Database connection issues
Make sure `DATABASE_URL` has `?sslmode=require` for Neon/PlanetScale

## Cost Comparison

| Platform | Plan | Cost | Limits |
|----------|------|------|--------|
| Vercel Hobby | Free | $0 | 10s timeout |
| Vercel Pro | Paid | $20/mo | 60s timeout |
| Railway | Paid | $5-10/mo | No timeout |

**Recommended**: Railway backend + Vercel Hobby frontend = **$5-10/month total**
