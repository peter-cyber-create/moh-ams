#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$ROOT/../backups"
mkdir -p "$OUT_DIR"
URL="${FINANCE_DATABASE_URL:-postgresql://ims:ims_secret@localhost:5435/ims_db}"
FILE="$OUT_DIR/ims_db-$STAMP.dump"
echo "Backing up $URL to $FILE"
pg_dump "$URL" -Fc -f "$FILE"
echo "$FILE"
echo "$STAMP" > "$OUT_DIR/latest-stamp.txt"
echo "$FILE" > "$OUT_DIR/latest-dump.txt"
ls -l "$FILE"
