#!/usr/bin/env bash
# Build locally and publish to the server over SSH. Config: .env.deploy
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.deploy ]]; then
  echo "Missing .env.deploy (copy .env.deploy.example)" >&2
  exit 1
fi
source .env.deploy
: "${DEPLOY_HOST:?}" "${DEPLOY_DIR:?}"

npm run check
npm run build

ssh "$DEPLOY_HOST" "mkdir -p $DEPLOY_DIR/site $DEPLOY_DIR/data $DEPLOY_DIR/fetcher $DEPLOY_DIR/nginx"
rsync -az --delete dist/site/ "$DEPLOY_HOST:$DEPLOY_DIR/site/"
rsync -az --delete dist/fetcher/ "$DEPLOY_HOST:$DEPLOY_DIR/fetcher/"
rsync -az --delete deploy/nginx/ "$DEPLOY_HOST:$DEPLOY_DIR/nginx/"
rsync -az deploy/docker-compose.yml "$DEPLOY_HOST:$DEPLOY_DIR/"

ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR \
  && docker compose up -d \
  && docker compose exec web nginx -s reload \
  && docker compose run --rm fetcher \
  && docker compose ps"
