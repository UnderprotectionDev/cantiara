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

wait_for_cloud_start() {
	local start_dir="/tmp/cursor/start-user"
	if [[ ! -d "$start_dir" ]]; then
		return 0
	fi
	for _ in {1..90}; do
		if [[ -f "$start_dir/start-user.status" ]]; then
			return 0
		fi
		sleep 1
	done
}

wait_for_cloud_start

bash "$REPO_ROOT/scripts/cloud-agent/prisma-generate.sh" >/dev/null

bash "$REPO_ROOT/scripts/cloud-agent/stop-stale-dev-listeners.sh"

cd "$REPO_ROOT"
exec bun run dev
