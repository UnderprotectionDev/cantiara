#!/usr/bin/env bash
# Run an app process against the product DATABASE_URL.
#
# When Cursor injects a hosted Neon URL, drop NEON_LOCAL so Prisma does not
# tunnel that URL through the local WebSocket proxy. Local Postgres is still
# used when DATABASE_URL itself is loopback.
set -euo pipefail

cantiara_is_hosted_database() {
	[[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" != *127.0.0.1* && "${DATABASE_URL}" != *localhost* ]]
}

cantiara_apply_product_database() {
	if cantiara_is_hosted_database; then
		unset NEON_LOCAL
		unset NEON_LOCAL_PROXY
	fi
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
	cantiara_apply_product_database
	return 0
fi

if [[ $# -lt 1 ]]; then
	printf 'usage: %s <command>...\n' "$0" >&2
	exit 2
fi

cantiara_apply_product_database
exec "$@"
