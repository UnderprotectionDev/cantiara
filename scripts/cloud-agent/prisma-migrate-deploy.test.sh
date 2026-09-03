#!/usr/bin/env bash
# A migration failure must prevent the product API from starting.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/cloud-agent/prisma-migrate-deploy.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat >"$TMP/bunx" <<'STUB'
#!/usr/bin/env bash
if [[ "$*" == *"migrate status"* ]]; then
	exit 0
fi
exit 23
STUB
chmod +x "$TMP/bunx"

if DATABASE_URL="postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/neondb" \
	PATH="$TMP:$PATH" \
	bash "$SCRIPT" >/dev/null 2>&1
then
	printf 'FAIL migration failure was swallowed\n' >&2
	exit 1
fi

cat >"$TMP/bunx" <<'STUB'
#!/usr/bin/env bash
if [[ "$*" == *"migrate status"* ]]; then
	printf 'Database schema is up to date!\n'
	exit 0
fi
printf 'Error: P1002\nTimed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).\n' >&2
exit 1
STUB
chmod +x "$TMP/bunx"

if ! DATABASE_URL="postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/neondb" \
	PATH="$TMP:$PATH" \
	CANTIARA_MIGRATE_LOCK_ATTEMPTS=1 \
	bash "$SCRIPT" >/dev/null 2>&1
then
	printf 'FAIL up-to-date schema still blocked the API on an advisory lock\n' >&2
	exit 1
fi

cat >"$TMP/bunx" <<'STUB'
#!/usr/bin/env bash
if [[ "$*" == *"migrate status"* ]]; then
	printf 'Following migrations have not yet been applied:\n20260101000000_example\n'
	exit 0
fi
printf 'Error: P1002\nTimed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).\n' >&2
exit 1
STUB
chmod +x "$TMP/bunx"

if DATABASE_URL="postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/neondb" \
	PATH="$TMP:$PATH" \
	CANTIARA_MIGRATE_LOCK_ATTEMPTS=1 \
	bash "$SCRIPT" >/dev/null 2>&1
then
	printf 'FAIL pending migrations were skipped because of an advisory lock\n' >&2
	exit 1
fi

printf 'ok\n'
