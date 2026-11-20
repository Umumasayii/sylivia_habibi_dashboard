#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Download all submissions of the KoBoToolbox form through the API (v2).
# Needs: KOBO_TOKEN, KOBO_ASSET_UID; optional KOBO_SERVER (default kf.kobotoolbox.org)
# Writes: .kobo/submissions.json (not committed) and, in GitHub Actions,
#         the outputs n, hash and changed (vs. public/data/source_hash.txt)
# -----------------------------------------------------------------------------
set -euo pipefail

: "${KOBO_TOKEN:?KOBO_TOKEN is not set}"
: "${KOBO_ASSET_UID:?KOBO_ASSET_UID is not set}"
SERVER="${KOBO_SERVER:-https://kf.kobotoolbox.org}"
[[ "$SERVER" == http* ]] || SERVER="https://$SERVER"
SERVER="${SERVER%/}"

mkdir -p .kobo
: > .kobo/records.jsonl
URL="$SERVER/api/v2/assets/$KOBO_ASSET_UID/data/?format=json&limit=5000"
PAGES=0
while [[ -n "$URL" ]]; do
  curl -fsS --retry 4 --retry-delay 5 --max-time 120 \
       -H "Authorization: Token $KOBO_TOKEN" -H "Accept: application/json" \
       "$URL" -o .kobo/page.json
  jq -c '.results[]' .kobo/page.json >> .kobo/records.jsonl
  URL="$(jq -r '.next // empty' .kobo/page.json)"
  PAGES=$((PAGES + 1))
  [[ $PAGES -lt 200 ]] || { echo "Too many pages; stopping." >&2; exit 1; }
done

jq -s 'sort_by(._id)' .kobo/records.jsonl > .kobo/submissions.json
N="$(jq 'length' .kobo/submissions.json)"
HASH="$(sha256sum .kobo/submissions.json | cut -d' ' -f1)"
OLD="$(cat public/data/source_hash.txt 2>/dev/null || true)"
CHANGED=true; [[ "$HASH" == "$OLD" ]] && CHANGED=false

echo "KoBoToolbox: $N submissions · changed since last build: $CHANGED"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  { echo "n=$N"; echo "hash=$HASH"; echo "changed=$CHANGED"; } >> "$GITHUB_OUTPUT"
fi
