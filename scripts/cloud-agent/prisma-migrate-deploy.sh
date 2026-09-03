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
lock_attempts="${CANTIARA_MIGRATE_LOCK_ATTEMPTS:-5}"

is_advisory_lock() {
	printf '%s\n' "$1" | grep -q 'pg_advisory_lock'
}

cd "$REPO_ROOT/packages/db"
status_out="$(DATABASE_URL="$migrate_url" bunx --bun prisma migrate status 2>&1 || true)"
printf '%s\n' "$status_out"

attempt=1
while true; do
	set +e
	deploy_out="$(DATABASE_URL="$migrate_url" bunx --bun prisma migrate deploy "$@" 2>&1)"
	code=$?
	set -e
	if [[ "$code" -eq 0 ]]; then
		printf '%s\n' "$deploy_out"
		exit 0
	fi
	if is_advisory_lock "$deploy_out"; then
		if printf '%s\n' "$status_out" | grep -q 'Database schema is up to date'; then
			printf '%s\n' "$deploy_out" >&2
			printf '[migrate] schema is already applied; starting the API despite an advisory lock\n' >&2
			exit 0
		fi
		if [[ "$attempt" -ge "$lock_attempts" ]]; then
			printf '%s\n' "$deploy_out" >&2
			exit "$code"
		fi
		attempt=$((attempt + 1))
		sleep 2
		continue
	fi
	printf '%s\n' "$deploy_out" >&2
	exit "$code"
done
