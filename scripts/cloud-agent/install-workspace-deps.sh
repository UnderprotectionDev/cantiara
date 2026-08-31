#!/usr/bin/env bash
# Install workspace packages from bun.lock.
# Warm-fork snapshots skip install.sh, so start.sh and run-dev.sh must
# reconcile node_modules after checkout or Vite cannot resolve packages
# added since the snapshot (for example @tanstack/react-table).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
cd "$REPO_ROOT"
exec bun install --frozen-lockfile
