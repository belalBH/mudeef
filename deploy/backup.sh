#!/usr/bin/env bash
# Daily SQLite backup. Add to crontab:  0 3 * * * /home/mudeef/app/deploy/backup.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${DATABASE_PATH:-$APP_DIR/data/mudeef.db}"
OUT="$APP_DIR/backups"
mkdir -p "$OUT"
sqlite3 "$DB" ".backup '$OUT/mudeef-$(date +%F).db'"
# keep the last 14 days
find "$OUT" -name 'mudeef-*.db' -mtime +14 -delete
