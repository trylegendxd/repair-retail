#!/usr/bin/env bash
set -euo pipefail

# Standard Next.js build for Vercel deployment
# Replaces vinext build for Cloudflare Workers

echo "Building RepairTrace Find with Next.js..."

# Run the Next.js build
npm run build

echo "Build completed successfully!"
echo "Ready for deployment to Vercel."
