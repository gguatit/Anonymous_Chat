#!/bin/bash

# Deploy script for Cloudflare Workers and Pages

set -e

echo "🚀 Anonymous Chat Deployment Script"
echo "===================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Login check
echo "🔐 Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

# Deploy Workers
echo ""
echo "📦 Deploying to Cloudflare Pages..."
echo "Note: For Cloudflare Pages, deployment is handled by the Pages dashboard."
echo "This script will prepare and test the worker code."
echo ""

# Test the worker syntax
echo "🔍 Testing worker syntax..."
npx wrangler deploy --dry-run

echo ""
echo "✅ Worker syntax validated successfully!"
echo ""
echo "📊 Deployment Instructions:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For Cloudflare Pages deployment:"
echo "1. Push your code to GitHub"
echo "2. Cloudflare Pages will automatically build and deploy"
echo "3. Build command: npm install"
echo "4. Build output directory: public"
echo "5. Environment variables are configured in Pages dashboard"
echo ""
echo "For direct Worker deployment (alternative):"
echo "  wrangler deploy --env=\"\""
echo ""
echo "📈 Monitoring:"
echo "  • Logs: wrangler tail"
echo "  • Metrics: https://kalpha.mmv.kr/metrics"
echo "  • Health: https://kalpha.mmv.kr/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
