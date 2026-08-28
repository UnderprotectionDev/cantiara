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

printf 'ok\n'
