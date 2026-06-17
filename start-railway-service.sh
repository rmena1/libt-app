#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if [[ "${RAILWAY_SERVICE_NAME:-}" == "libt-app-zero" ]] || [[ -n "${ZERO_APP_ID:-}" && -n "${ZERO_UPSTREAM_DB:-}" ]]; then
  exec bash ./start-zero-cache-railway.sh
fi

npm run db:bootstrap
exec npm run start
