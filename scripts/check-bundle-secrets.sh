#!/usr/bin/env bash
# Fails if anything the browser can download contains a server secret.
set -euo pipefail

SENTINEL_CLIENT="sentinel-client-secret-must-never-ship-to-the-browser"
SENTINEL_SESSION="sentinel-session-secret-must-never-ship-to-the-browser-x"

rm -rf .next
AUTH_BASE="http://127.0.0.1:9000" \
MEMORARE_CLIENT_ID="sentinel-client-id" \
MEMORARE_CLIENT_SECRET="$SENTINEL_CLIENT" \
MEMORARE_REDIRECT_URI="http://localhost:3000/auth/callback" \
APP_URL="http://localhost:3000" \
SESSION_SECRET="$SENTINEL_SESSION" \
  npm run build >/dev/null

# Turbopack snapshots env values into its own cache, which is never served.
rm -rf .next/cache

fail=0
for needle in "$SENTINEL_CLIENT" "$SENTINEL_SESSION"; do
  if hits=$(grep -rlF -- "$needle" .next 2>/dev/null); then
    echo "FAIL: secret found in build output:"; echo "$hits"; fail=1
  fi
done

if hits=$(grep -rn "NEXT_PUBLIC_" app lib 2>/dev/null); then
  echo "FAIL: NEXT_PUBLIC_ variables are not allowed in this app:"; echo "$hits"; fail=1
fi

if [ "$fail" -eq 0 ]; then echo "OK: no server secret reaches the browser bundle"; fi
exit "$fail"
