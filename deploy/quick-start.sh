#!/usr/bin/env bash
# Quick preview on a fresh VPS, reachable at http://SERVER_IP:PORT (no domain needed)
# Usage (from the project folder):  bash deploy/quick-start.sh
set -euo pipefail
PORT="${PORT:-8080}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Installing system packages"
apt-get update -y
apt-get install -y curl build-essential python3 sqlite3 unzip

if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

IP="$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')"

if [ ! -f .env ]; then
  echo "==> Creating .env"
  cat > .env <<EOF
APP_URL=http://$IP:$PORT
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
COOKIE_SECURE=false
DATABASE_PATH=./data/mudeef.db
SYNC_INTERVAL_MINUTES=15
CRON_SECRET=$(openssl rand -hex 16)
PORT=$PORT
EOF
fi

echo "==> Installing and building"
npm ci
npm run build

echo "==> Starting with PM2 on port $PORT"
pm2 delete mudeef >/dev/null 2>&1 || true
PORT=$PORT pm2 start node_modules/next/dist/bin/next --name mudeef -- start -p "$PORT"
pm2 save
sleep 6

echo "==> Loading demo data"
npm run seed || true

if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow "$PORT"/tcp
fi

echo ""
echo "========================================"
echo " Open:  http://$IP:$PORT"
echo " Demo:  demo@mudeef.sa / demo1234"
echo "========================================"
