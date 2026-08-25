#!/usr/bin/env bash
# Cloud Agent turborepo dev servers.
# Regenerate the Prisma client before boot so a reused snapshot cannot serve
# Account Preferences (and later models) with a stale client.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
# shellcheck source=use-product-database.sh
source "$REPO_ROOT/scripts/cloud-agent/use-product-database.sh"

(
	cd "$REPO_ROOT/packages/db"
	bunx prisma generate >/dev/null
)

cd "$REPO_ROOT"
exec bun run dev
