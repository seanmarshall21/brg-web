#!/usr/bin/env bash
# verify-live.sh — confirm every BRG page renders live on WordPress.
# Run this AFTER the WP pages exist (each holding its [brg_<slug>] shortcode).
# Usage:  bash scripts/verify-live.sh [base-url]
#         base-url defaults to https://blacktoprestaurantgroup.com
#
# Per page it checks:  HTTP 200 · the <!-- vc_embed brg/<slug> vX -->
# marker (proves the plugin ran and which version) · the injected .brgw-header nav.
set -u
BASE="${1:-https://blacktoprestaurantgroup.com}"
BASE="${BASE%/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUGS=$(python3 -c "import json;print(' '.join(p['slug'] for p in json.load(open('$ROOT/website/pages.json'))))")

pass=0; fail=0
printf "Verifying against %s\n\n" "$BASE"
for slug in $SLUGS; do
  if [ "$slug" = "home" ]; then url="$BASE/"; else url="$BASE/$slug/"; fi
  body=$(curl -sL --max-time 20 -w '\n%{http_code}' "$url")
  code=$(printf '%s' "$body" | tail -1)
  html=$(printf '%s' "$body" | sed '$d')
  marker=$(printf '%s' "$html" | grep -o "<!-- vc_embed brg/[a-z0-9-]* v[0-9.]* -->" | head -1)
  nav=$(printf '%s' "$html" | grep -o 'brgw-header' | head -1)
  if [ "$code" = "200" ] && [ -n "$marker" ] && [ -n "$nav" ]; then
    printf "  ✅ %-16s %s | nav ✓\n" "$slug" "${marker:-no-marker}"; pass=$((pass+1))
  else
    printf "  ❌ %-16s HTTP %s | %s | nav:%s\n" "$slug" "$code" "${marker:-NO MARKER}" "${nav:-missing}"; fail=$((fail+1))
  fi
done
printf "\n%d passed, %d failed\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
