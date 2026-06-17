#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if [[ "${RAILWAY_SERVICE_NAME:-}" == "libt-app-zero" ]] || [[ -n "${ZERO_APP_ID:-}" && -n "${ZERO_UPSTREAM_DB:-}" ]]; then
  echo "Skipping Next.js build for zero-cache service."
  exit 0
fi

exec npm run build
