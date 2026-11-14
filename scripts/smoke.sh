#!/usr/bin/env bash
# Smoke test of deploy/nginx/default.conf with the built site, using the same
# mounts as deploy/docker-compose.yml. Needs docker and curl.
# Env: SMOKE_PORT (default 8089), SMOKE_SKIP_BUILD=1 reuses an existing dist/.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-8089}"
NAME="baywatch-smoke-$$"
TMP="$(mktemp -d)"
FAILS=0

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

[[ "${SMOKE_SKIP_BUILD:-}" == 1 && -f dist/site/index.html ]] || npm run build

# Lay out a temp dir like ~/baywatch on the server.
mkdir -p "$TMP/site" "$TMP/data" "$TMP/nginx"
cp -r dist/site/. "$TMP/site/"
cp -r deploy/nginx/. "$TMP/nginx/"
if [[ -f src/web/public/data/forecast.json ]]; then
  cp src/web/public/data/forecast.json "$TMP/data/"
else
  OUT_DIR="$TMP/data" node dist/fetcher/fetch.mjs
fi
[[ -f "$TMP/data/status.json" ]] || echo '{"consecutiveFailures":0}' > "$TMP/data/status.json"
chmod -R a+rX "$TMP"

docker run -d --rm --name "$NAME" -p "127.0.0.1:$PORT:80" \
  -v "$TMP/site:/usr/share/nginx/html:ro,z" \
  -v "$TMP/data:/usr/share/nginx/data:ro,z" \
  -v "$TMP/nginx:/etc/nginx/conf.d:ro,z" \
  nginx:alpine >/dev/null

for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

BASE="http://127.0.0.1:$PORT"
HDR="$TMP/h"

# check <path> <status> [header-regex ...]; headers are matched case-insensitively.
check() {
  local path="$1" want="$2" code ok=1 re
  shift 2
  code="$(curl -s -D "$HDR" -o "$TMP/body" -w '%{http_code}' -H 'Accept-Encoding: gzip' "$BASE$path")"
  [[ "$code" == "$want" ]] || ok=0
  for re in "$@"; do
    grep -qiE "$re" "$HDR" || { ok=0; echo "    missing header /$re/"; }
  done
  if ((ok)); then echo "ok    $path ($code)"; else echo "FAIL  $path (got $code, want $want)"; FAILS=$((FAILS + 1)); fi
}

asset="$(cd "$TMP/site" && ls assets/*.js | head -1)"
icon="$(cd "$TMP/site" && ls icons/*.png | head -1)"

check / 200 '^content-type: text/html' '^cache-control: no-cache'
check /data/forecast.json 200 '^content-type: application/json' '^cache-control: public, max-age=300' '^content-encoding: gzip'
check /data/status.json 200 '^content-type: application/json' '^cache-control: no-cache'
check /manifest.webmanifest 200 '^content-type: application/manifest\+json' '^cache-control: no-cache'
check /sw.js 200 '^cache-control: no-cache'
check "/$asset" 200 '^cache-control: public, max-age=31536000, immutable'
check "/$icon" 200 '^content-type: image/png' '^cache-control: no-cache'
check /does-not-exist 404
check /data/does-not-exist.json 404
check /data/ 403
check /assets/ 403

# No directory listing anywhere.
for p in /data/ /assets/ /icons/; do
  if curl -s "$BASE$p" | grep -qi 'index of'; then
    echo "FAIL  $p lists a directory"; FAILS=$((FAILS + 1))
  fi
done

# The forecast must parse as JSON.
if curl -s "$BASE/data/forecast.json" | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'; then
  echo "ok    forecast.json parses"
else
  echo "FAIL  forecast.json is not valid JSON"; FAILS=$((FAILS + 1))
fi

if ((FAILS)); then echo "$FAILS check(s) failed"; exit 1; fi
echo "All checks passed"
