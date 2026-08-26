#!/usr/bin/env bash
# Cloud Agent turborepo dev servers.
# Regenerate the Prisma client before boot so a reused snapshot cannot serve
# Account Preferences (and later models) with a stale client.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3001}"
export VITE_SERVER_URL="${VITE_SERVER_URL:-http://localhost:3000}"
export NODE_ENV="${NODE_ENV:-development}"
# shellcheck source=use-product-database.sh
source "$REPO_ROOT/scripts/cloud-agent/use-product-database.sh"

(
	cd "$REPO_ROOT/packages/db"
	bunx prisma generate >/dev/null
)

cd "$REPO_ROOT"
exec bun run dev
