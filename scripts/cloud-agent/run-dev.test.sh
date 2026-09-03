#!/usr/bin/env bash
# Cursor only forwards 3000/3001/4000 while a process listens. A migrate
# deploy failure must not abort run-dev before `bun run dev`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/cloud-agent/run-dev.sh"

if ! grep -q 'if ! bash "$REPO_ROOT/scripts/cloud-agent/prisma-migrate-deploy.sh"' "$SCRIPT"; then
	printf 'FAIL run-dev.sh must continue when migrate deploy fails\n' >&2
	exit 1
fi

if ! grep -q 'exec bun run dev' "$SCRIPT"; then
	printf 'FAIL run-dev.sh must exec bun run dev so 3000/3001/4000 bind\n' >&2
	exit 1
fi

printf 'ok\n'
