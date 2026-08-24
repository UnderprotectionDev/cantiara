#!/usr/bin/env bash
# Behaviour tests for write-server-env.sh. No secret values are asserted.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=write-server-env.sh
source "$ROOT/scripts/cloud-agent/write-server-env.sh"

fail() {
	printf 'FAIL: %s\n' "$*" >&2
	exit 1
}

assert_eq() {
	local actual="$1" expected="$2" label="$3"
	[[ "$actual" == "$expected" ]] || fail "$label: expected '$expected', got '$actual'"
}

assert_file_has() {
	local file="$1" needle="$2" label="$3"
	grep -Fq "$needle" "$file" || fail "$label: '$file' missing '$needle'"
}

assert_file_lacks() {
	local file="$1" needle="$2" label="$3"
	grep -Fq "$needle" "$file" && fail "$label: '$file' unexpectedly contains '$needle'" || true
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
DEST="$TMP/apps/server/.env"

unset DATABASE_URL NEON_LOCAL BETTER_AUTH_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
export BETTER_AUTH_URL="http://localhost:3000"
export CORS_ORIGIN="http://localhost:3001"
export NODE_ENV="development"

# Local fallback when no secrets are injected.
outcome="$(apply_server_env "$DEST")"
assert_eq "$outcome" "local-postgres" "no secrets"
assert_file_has "$DEST" "DATABASE_URL=postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara" "local url"
assert_file_has "$DEST" "NEON_LOCAL=true" "local neon flag"
assert_file_lacks "$DEST" "GITHUB_CLIENT_ID=" "no github id without secret"

# Existing local env is kept when secrets are still absent.
echo "MARKER=keep-me" >>"$DEST"
outcome="$(apply_server_env "$DEST")"
assert_eq "$outcome" "kept" "keep existing local env"
assert_file_has "$DEST" "MARKER=keep-me" "preserved custom local env"

# Hosted Neon secret writes a fresh env without NEON_LOCAL.
rm -f "$DEST"
export DATABASE_URL="postgresql://neondb_owner:secret@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require"
export GITHUB_CLIENT_ID="github-client-id"
export GITHUB_CLIENT_SECRET="github-client-secret"
export BETTER_AUTH_SECRET="test-secret-test-secret-test-secret-32"
outcome="$(apply_server_env "$DEST")"
assert_eq "$outcome" "hosted-neon" "hosted neon secrets"
assert_file_has "$DEST" "DATABASE_URL=${DATABASE_URL}" "hosted url copied"
assert_file_lacks "$DEST" "NEON_LOCAL=" "hosted omits neon local"
assert_file_has "$DEST" "GITHUB_CLIENT_ID=github-client-id" "github id copied"
assert_file_has "$DEST" "GITHUB_CLIENT_SECRET=github-client-secret" "github secret copied"

# Hosted secret overwrites a leftover local .env from a snapshot.
printf 'DATABASE_URL=postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara\nNEON_LOCAL=true\n' >"$DEST"
outcome="$(apply_server_env "$DEST")"
assert_eq "$outcome" "hosted-neon" "overwrite local snapshot env"
assert_file_has "$DEST" "ep-example.eu-central-1.aws.neon.tech" "hosted host after overwrite"
assert_file_lacks "$DEST" "NEON_LOCAL=" "overwrite drops neon local"

printf 'PASS\n'
