#!/usr/bin/env bash
# One-shot Mac Mini setup for JobPilot
# Run from the repo root: bash scripts/setup-mac-mini.sh

set -e

echo "==> Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Install via: brew install node"
  exit 1
fi
echo "    Node $(node -v)"

echo "==> Installing dependencies..."
npm install --production=false

echo "==> Running database migrations..."
npm run db:migrate

echo "==> Installing Playwright Chromium..."
npx playwright install chromium

echo "==> Building Next.js app..."
npm run build

echo "==> Installing PM2 globally (if needed)..."
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

echo "==> Starting processes with PM2..."
pm2 start ecosystem.config.js

echo "==> Saving PM2 process list for auto-start on reboot..."
pm2 save

echo ""
echo "Setup complete. Status:"
pm2 status

echo ""
echo "Dashboard: http://localhost:3000"
echo "Logs:      pm2 logs"
echo "Stop all:  pm2 stop all"
