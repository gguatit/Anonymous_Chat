#!/bin/bash

# Pre-deploy validation for Anonymous Chat (Cloudflare Workers).
# Runs the local gate (tests, lint, build) plus a Wrangler dry-run.
# This script does NOT deploy anything. Deploy with: npm run deploy

set -e

echo "Anonymous Chat Pre-Deploy Check"
echo "================================"

if ! command -v wrangler &> /dev/null; then
    echo "Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

echo ""
echo "1/3 Tests..."
npm test

echo ""
echo "2/3 Build + lint..."
npm run build

echo ""
echo "3/3 Wrangler dry-run..."
npx wrangler deploy --dry-run

echo ""
echo "All checks passed."
echo ""
echo "Deploy:"
echo "  npm run deploy                                            # build + wrangler deploy"
echo "  wrangler d1 migrations apply anonymous-chat-db --remote  # if schema changed"
echo ""
echo "Monitoring:"
echo "  wrangler tail"
echo "  https://kalpha.mmv.kr/health"
echo "  https://kalpha.mmv.kr/metrics"
