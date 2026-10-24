#!/usr/bin/env bash
# Pull the latest version from GitHub and restart: bash deploy/update.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Backing up the database"
mkdir -p backups
[ -f data/mudeef.db ] && sqlite3 data/mudeef.db ".backup 'backups/before-update-$(date +%F-%H%M).db'" || true

echo "==> Getting the latest code"
git pull --ff-only

echo "==> Installing and building"
npm ci
npm run build

echo "==> Restarting"
pm2 restart mudeef --update-env
sleep 5
# The database upgrades itself on first start; refresh the demo account with the new sample data
npm run seed || true
echo "==> Done"
