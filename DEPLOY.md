# VADR Deployment Guide

Complete deployment guide for the VADR monorepo (backend on Railway, frontend on Vercel).

## Prerequisites

1. Railway CLI installed:
```bash
npm install -g @railway/cli
```

2. Railway account (sign up at https://railway.app)
3. Vercel account (sign up at https://vercel.com)

## Monorepo Structure

```
VADR/
├── packages/
│   ├── backend/       # Fastify API → Railway
│   ├── frontend/      # Next.js app → Vercel
│   └── shared/        # Shared types (Zod schemas)
├── railway.toml       # Railway configuration
└── package.json       # Monorepo workspace config
```

## Backend Deployment (Railway)

### 1. Navigate to the project root

```bash
cd /path/to/VADR
```

> The root-level `railway.toml` tells Railway to build from `packages/backend/` with the entire monorepo as build context.

### 2. Login to Railway

```bash
railway login
```

This will open your browser for authentication.

### 3. Create New Project

```bash
railway init
```

Follow the prompts:
- Create a new project
- Give it a name (e.g., "vadr-backend")

### 4. Set Environment Variables

Use the `--set` flag with `"KEY=VALUE"` format:

```bash
railway variables \
  --set "TWILIO_ACCOUNT_SID=<your_twilio_account_sid>" \
  --set "TWILIO_AUTH_TOKEN=<your_twilio_auth_token>" \
  --set "TWILIO_PHONE_NUMBER=<your_twilio_phone_number>" \
  --set "OPENAI_API_KEY=<your_openai_api_key>" \
  --set "DATABASE_URL=<your_database_url>" \
  --set "GOOGLE_PLACES_API_KEY=<your_google_places_api_key>" \
  --set "TWILIO_VOICE_NAME=Google.en-US-Neural2-F" \
  --set "VOICE_AGENT_MODEL=gpt-4o-mini" \
  --set "NODE_ENV=production" \
  --set "PORT=3001"
```

### 5. Deploy

```bash
railway up
```

Wait for deployment to complete. You'll see build logs in your terminal. Any future pushes to the main branch will trigger the same install/build/start steps automatically.

### 6. Get Your Public URL

```bash
railway domain
```

If you don't have a domain yet, generate one:

```bash
railway domain --create
```

This will give you a URL like: `https://vadr-backend-production-xyz.up.railway.app`

### 7. Update Backend URLs

Now that you have your Railway URL, set these additional variables:

```bash
railway variables \
  --set "PUBLIC_BASE_URL=https://your-railway-url.up.railway.app" \
  --set "FRONTEND_URL=https://vadr-five.vercel.app"
```

**Replace `your-railway-url.up.railway.app` with your actual Railway domain!**

### 8. Verify Deployment

Test the health endpoint:

```bash
curl https://your-railway-url.up.railway.app/health
```

You should see:
```json
{"status":"ok","timestamp":"2025-11-02T..."}
```

### 9. Update Twilio Webhooks

Go to [Twilio Console](https://console.twilio.com/):

1. Navigate to Phone Numbers → Manage → Active Numbers
2. Click on your Twilio phone number
3. Scroll to "Voice Configuration"
4. Update these URLs (replace with your Railway URL):
   - **A CALL COMES IN**: `https://your-railway-url.railway.app/api/twilio/outbound`
   - **Method**: POST
   - **Status Callbacks**: `https://your-railway-url.railway.app/api/twilio/status`
5. Click "Save configuration"

### 10. Update Frontend (Vercel)

Go to [Vercel Dashboard](https://vercel.com/):

1. Select your VADR project
2. Go to Settings → Environment Variables
3. Add new variable:
   - **Name**: `NEXT_PUBLIC_BACKEND_URL`
   - **Value**: `https://your-railway-url.railway.app`
   - **Environments**: Production, Preview, Development
4. Click "Save"
5. Redeploy: Go to Deployments → Click "..." on latest → Redeploy

## Testing

### 1. Test Backend Health

```bash
curl https://your-railway-url.railway.app/health
```

### 2. Test Search Endpoint

```bash
curl "https://your-railway-url.railway.app/api/search?q=hair%20salons&lat=37.7749&lng=-122.4194"
```

### 3. Test Full Flow

1. Open your Vercel frontend: https://vadr-five.vercel.app
2. Search for businesses (should use backend)
3. Start a call (should not timeout after 10s)
4. Watch live transcripts (should stream via SSE)
5. Verify voice sounds natural (Google Neural TTS)

## Monitoring

### View Logs

```bash
railway logs
```

### View Metrics

```bash
railway status
```

### View in Dashboard

```bash
railway open
```

This opens the Railway dashboard in your browser.

## Troubleshooting

### Build Fails

Check logs:
```bash
railway logs --deployment
```

Common issues:
- Missing dependencies: Check `package.json`
- TypeScript errors: Run `bun run build` locally first
- Prisma errors: Make sure `postinstall` script runs

### Backend Responds 500

Check environment variables:
```bash
railway variables
```

Make sure all required vars are set:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- OPENAI_API_KEY
- DATABASE_URL
- GOOGLE_PLACES_API_KEY

### CORS Errors

Verify `FRONTEND_URL` matches your Vercel domain exactly:
```bash
railway variables --set "FRONTEND_URL=https://vadr-five.vercel.app"
```

### Twilio Webhooks Fail

1. Check `PUBLIC_BASE_URL` is set to your Railway URL
2. Verify webhook URLs in Twilio console are correct
3. Test manually:
   ```bash
   curl https://your-railway-url.railway.app/api/twilio/status
   ```

### Database Connection Issues

Make sure DATABASE_URL includes `?sslmode=require` for Neon/PlanetScale.

## Cost

Railway pricing (as of 2025):
- **Hobby Plan**: $5/month
- **Resource-based**: ~$0.000463/GB-hour RAM + $0.000231/vCPU-hour

Estimated cost for VADR backend: **$5-10/month**

## Rollback

If you need to rollback:

1. View deployments:
   ```bash
   railway deployments
   ```

2. Rollback to previous:
   ```bash
   railway rollback <deployment-id>
   ```

## Local Development

To test backend locally with Railway database:

```bash
# Link to Railway project
railway link

# Run locally with Railway env vars
railway run bun run dev
```

## Frontend Deployment (Vercel)

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Import your GitHub repository
3. Configure the following:
   - **Root Directory**: `packages/frontend`
   - **Framework Preset**: Next.js
   - **Build Command**: `bun run build`
   - **Output Directory**: `.next`
   - **Install Command**: `bun install`

### 2. Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-railway-url.railway.app
```

> **Important**: Update this with your actual Railway backend URL after backend deployment

### 3. Deploy

Click "Deploy" and Vercel will automatically build and deploy your frontend.

### 4. Get Your Frontend URL

After deployment, Vercel will provide a URL like: `https://vadr-five.vercel.app`

### 5. Update Backend CORS

Update your Railway backend environment variable:

```bash
railway variables set FRONTEND_URL=https://your-vercel-app.vercel.app
```

> **Note**: The backend automatically allows all `*.vercel.app` domains, but setting this explicitly helps with logging.

## Next Steps

Once deployed:

1. ✅ Test voice calls don't timeout
2. ✅ Verify transcripts stream in real-time
3. ✅ Check voice quality (should be natural)
4. ✅ Monitor Railway logs for errors
5. ✅ Verify frontend connects to backend correctly
6. 🔄 Set up monitoring/alerting (optional)

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Vercel Docs: https://vercel.com/docs
- VADR Issues: Create GitHub issue in your repo
