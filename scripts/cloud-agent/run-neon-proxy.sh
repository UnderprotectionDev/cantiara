#!/usr/bin/env bash
# Neon serverless WebSocket proxy for local Postgres on 5433.
# App traffic still follows injected DATABASE_URL (hosted Neon is not tunneled).
# The process always binds so Cloud Agent port forwarding can expose 5433.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=use-product-database.sh
source "$REPO_ROOT/scripts/cloud-agent/use-product-database.sh"

if cantiara_is_hosted_database; then
	printf '[neon-proxy] App DATABASE_URL is hosted Neon; local 5433 tunnel still binds for port forwarding.\n'
fi

export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
cd "$REPO_ROOT"
exec bun run scripts/neon-local-proxy.ts
