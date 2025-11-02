#!/bin/bash
# VADR Backend Deployment Script
# Run this after logging in with: railway login

set -e

echo "🚀 Deploying VADR Backend to Railway..."
echo ""

# Check if logged in
if ! railway whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Initialize if needed
if [ ! -f ".railway" ]; then
    echo "📦 Initializing Railway project..."
    railway init
    echo ""
fi

echo "⚙️  Setting environment variables..."

# Set all environment variables
railway variables \
  --set "TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID:?set TWILIO_ACCOUNT_SID before running}" \
  --set "TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:?set TWILIO_AUTH_TOKEN before running}" \
  --set "TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER:?set TWILIO_PHONE_NUMBER before running}" \
  --set "OPENAI_API_KEY=${OPENAI_API_KEY:?set OPENAI_API_KEY before running}" \
  --set "DATABASE_URL=${DATABASE_URL:?set DATABASE_URL before running}" \
  --set "GOOGLE_PLACES_API_KEY=${GOOGLE_PLACES_API_KEY:?set GOOGLE_PLACES_API_KEY before running}" \
  --set "TWILIO_VOICE_NAME=${TWILIO_VOICE_NAME:-Google.en-US-Neural2-F}" \
  --set "VOICE_AGENT_MODEL=${VOICE_AGENT_MODEL:-gpt-4o-mini}" \
  --set "NODE_ENV=${NODE_ENV:-production}" \
  --set "PORT=${PORT:-3001}" \
  --set "FRONTEND_URL=${FRONTEND_URL:-https://vadr-five.vercel.app}"

echo ""
echo "✅ Environment variables set"
echo ""

echo "🚢 Deploying to Railway..."
railway up

echo ""
echo "🌐 Getting public domain..."

# Try to get existing domain
DOMAIN=$(railway domain 2>&1)

if echo "$DOMAIN" | grep -q "No domains"; then
    echo "📍 Creating new domain..."
    DOMAIN=$(railway domain --create)
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Your backend URL: $DOMAIN"
echo ""
echo "📝 Next steps:"
echo "1. Update PUBLIC_BASE_URL:"
echo "   railway variables --set \"PUBLIC_BASE_URL=$DOMAIN\""
echo ""
echo "2. Test health endpoint:"
echo "   curl $DOMAIN/health"
echo ""
echo "3. Update Twilio webhooks to use:"
echo "   - Answer URL: $DOMAIN/api/twilio/outbound"
echo "   - Status Callback: $DOMAIN/api/twilio/status"
echo ""
echo "4. Update Vercel environment variable:"
echo "   NEXT_PUBLIC_BACKEND_URL=$DOMAIN"
echo ""
