#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${ROOT_DIR}/ads-library-media-saver-v0.4.0.zip"

cd "$ROOT_DIR"
rm -f "$OUT_FILE"
zip -r "$OUT_FILE" \
  manifest.json \
  background.js \
  scanner.js \
  popup.html \
  popup.css \
  popup.js \
  library.html \
  library.css \
  library.js \
  icons \
  README.md \
  GOOGLE_DRIVE_SETUP.md \
  PRIVACY.md >/dev/null

echo "$OUT_FILE"
