#!/usr/bin/env bash
# Load hosted product DATABASE_URL safely, then run the dev seed script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/cloud-agent/use-product-database.sh
source "${ROOT}/scripts/cloud-agent/use-product-database.sh"

if [[ $# -lt 1 ]]; then
	printf 'usage: %s <command>...\n' "$0" >&2
	exit 2
fi

exec "$@"
