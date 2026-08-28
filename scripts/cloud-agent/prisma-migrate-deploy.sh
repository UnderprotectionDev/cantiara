#!/usr/bin/env bash
# Apply pending Prisma migrations to the product DATABASE_URL.
# Prisma CLI: migrate deploy (CI/CD / non-dev). Never migrate reset / db push here.
# bunx --bun: Prisma CLI shebang is Node; Bun must run the CLI.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=use-product-database.sh
source "$REPO_ROOT/scripts/cloud-agent/use-product-database.sh"

if ! cantiara_is_hosted_database; then
	# Local throwaway Postgres is reconciled with db push in start.sh.
	exit 0
fi

# Neon pooled hostnames include `-pooler`; migrate needs a direct session.
migrate_url="${DATABASE_URL/-pooler./.}"

cd "$REPO_ROOT/packages/db"
DATABASE_URL="$migrate_url" bunx --bun prisma migrate status || true
DATABASE_URL="$migrate_url" bunx --bun prisma migrate deploy "$@"
