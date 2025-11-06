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
echo "📦 Deploying Cloudflare Worker..."
wrangler deploy

echo ""
echo "🌐 Deploying to Cloudflare Pages..."
wrangler pages deploy public --project-name=anonymous-chat

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Next steps:"
echo "1. Configure custom domain in Cloudflare dashboard (optional)"
echo "2. Set up environment variables if needed"
echo "3. Monitor logs: wrangler tail"
echo "4. View metrics at: https://your-worker.workers.dev/metrics"
