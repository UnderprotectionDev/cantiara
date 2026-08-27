#!/usr/bin/env bash
# Generate Prisma Client after schema or branch changes.
# bunx --bun: Prisma CLI shebang is Node; Bun must run the generator.
# --no-hints: keep errors, drop CLI ads (prisma generate --help).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT/packages/db"
exec bunx --bun prisma generate --no-hints "$@"
