#!/usr/bin/env bash
# Red: hosted DATABASE_URL must drop NEON_LOCAL before the app process starts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WRAP="$ROOT/scripts/cloud-agent/use-product-database.sh"
fail=0

assert_eq() {
	local name="$1" expected="$2" actual="$3"
	if [[ "$expected" != "$actual" ]]; then
		printf 'FAIL %s: expected %q got %q\n' "$name" "$expected" "$actual" >&2
		fail=1
	fi
}

hosted="postgresql://cantiara@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require"
local_url="postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara"

actual="$(
	DATABASE_URL="$hosted" NEON_LOCAL=true \
		bash "$WRAP" bash -c 'printf %s "${NEON_LOCAL-UNSET}"'
)"
assert_eq "hosted DATABASE_URL unsets NEON_LOCAL" "UNSET" "$actual"

actual="$(
	DATABASE_URL="$local_url" NEON_LOCAL=true \
		bash "$WRAP" bash -c 'printf %s "${NEON_LOCAL-UNSET}"'
)"
assert_eq "local DATABASE_URL keeps NEON_LOCAL" "true" "$actual"

if [[ "$fail" -ne 0 ]]; then
	exit 1
fi
printf 'ok\n'
