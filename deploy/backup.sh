#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-/root/ig_automatic_tools/api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/ig-automatic-tools}"
REMOTE="${RCLONE_REMOTE:-igtools-crypt:}"
KEEP_DAYS="${KEEP_DAYS:-7}"

DB_URI="$(grep -E '^DB_URI=' "$ENV_FILE" | cut -d= -f2-)"
if [ -z "$DB_URI" ]; then
  echo "DB_URI não definido em $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/ig-automatic-tools_$STAMP.archive.gz"

mongodump --uri="$DB_URI" --archive="$FILE" --gzip --quiet
chmod 600 "$FILE"

find "$BACKUP_DIR" -name 'ig-automatic-tools_*.archive.gz' -mtime +"$((KEEP_DAYS - 1))" -delete

rclone copy "$FILE" "$REMOTE" --quiet
rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d" --quiet || true

echo "backup concluído: $FILE"
