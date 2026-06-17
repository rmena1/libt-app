#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if [[ -n "${DATABASE_URL:-}" && -n "${ZERO_UPSTREAM_DB:-}" && "${DATABASE_URL}" != "${ZERO_UPSTREAM_DB}" ]]; then
  echo "DATABASE_URL and ZERO_UPSTREAM_DB must match for zero-cache startup." >&2
  exit 1
fi

database_url="${DATABASE_URL:-${ZERO_UPSTREAM_DB:-}}"
if [[ -z "${database_url}" ]]; then
  echo "DATABASE_URL or ZERO_UPSTREAM_DB must be set for zero-cache startup." >&2
  exit 1
fi

export DATABASE_URL="${database_url}"
export ZERO_UPSTREAM_DB="${database_url}"
export ZERO_PORT="${ZERO_PORT:-4848}"

retry_delay_seconds="${LIBT_ZERO_STARTUP_RETRY_DELAY_SECONDS:-5}"
attempt=1

while true; do
  echo "zero-cache startup attempt ${attempt}: bootstrapping database"
  if npm run db:bootstrap; then
    echo "zero-cache startup attempt ${attempt}: deploying Zero permissions"
    if npm run zero:deploy-permissions; then
      break
    fi
  fi

  echo "zero-cache startup attempt ${attempt} failed; retrying in ${retry_delay_seconds}s" >&2
  attempt=$((attempt + 1))
  sleep "${retry_delay_seconds}"
done

exec npm run zero:start
