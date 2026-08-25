#!/usr/bin/env bash
# Neon serverless WebSocket proxy for local Postgres.
# When DATABASE_URL is hosted Neon, do not tunnel; the API talks to Neon directly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=use-product-database.sh
source "$REPO_ROOT/scripts/cloud-agent/use-product-database.sh"

if cantiara_is_hosted_database; then
	printf '[neon-proxy] DATABASE_URL is hosted Neon; skipping local Postgres tunnel.\n'
	exec tail -f /dev/null
fi

export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
cd "$REPO_ROOT"
exec bun run scripts/neon-local-proxy.ts
