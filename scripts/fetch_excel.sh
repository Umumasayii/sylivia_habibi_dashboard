#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Download the Microsoft Forms responses workbook (Excel on SharePoint/OneDrive)
# through a view-only "Anyone with the link" share link.
# Needs:  EXCEL_URL  (GitHub secret)
# Writes: .excel/responses.xlsx (not committed) and, in GitHub Actions,
#         the outputs hash and changed (vs. public/data/source_hash.txt)
# -----------------------------------------------------------------------------
set -euo pipefail

: "${EXCEL_URL:?EXCEL_URL is not set}"
URL="$EXCEL_URL"
# Ask SharePoint/OneDrive for the file itself instead of the web viewer
if [[ "$URL" != *"download=1"* ]]; then
  if [[ "$URL" == *"?"* ]]; then URL="$URL&download=1"; else URL="$URL?download=1"; fi
fi

mkdir -p .excel
curl -fsSL --retry 4 --retry-delay 5 --max-time 120 \
     -A "Mozilla/5.0 (dashboard-bot)" "$URL" -o .excel/responses.xlsx

# An .xlsx file is a zip archive and starts with "PK"
if [[ "$(head -c 2 .excel/responses.xlsx)" != "PK" ]]; then
  echo "The link did not return an Excel file (got a web page instead)." >&2
  echo "Make sure the share link is set to 'Anyone with the link can view'." >&2
  exit 1
fi

# Hash the sheet contents only, so a re-download of unchanged data is not a change
HASH="$( { unzip -p .excel/responses.xlsx 'xl/worksheets/*.xml' 'xl/sharedStrings.xml' 2>/dev/null || true; } | sha256sum | cut -d' ' -f1)"
OLD="$(cat public/data/source_hash.txt 2>/dev/null || true)"
CHANGED=true; [[ "$HASH" == "$OLD" ]] && CHANGED=false

echo "Microsoft Forms workbook downloaded · changed since last build: $CHANGED"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  { echo "hash=$HASH"; echo "changed=$CHANGED"; } >> "$GITHUB_OUTPUT"
fi
