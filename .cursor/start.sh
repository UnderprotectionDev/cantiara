#!/usr/bin/env bash
# Per-boot Cloud Agent start step for cantiara.
#
# Brings up the per-boot daemons the dev servers depend on and then returns:
#   1. the local PostgreSQL server, and
#   2. the Neon local WebSocket proxy (scripts/neon-local-proxy.ts), which the
#      Neon serverless driver uses to reach local Postgres.
# The dev servers themselves run in the "dev" terminal.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# 1. PostgreSQL ----------------------------------------------------------------
PG_VER="$(pg_lsclusters -h 2>/dev/null | awk 'NR==1{print $1}')"
PG_VER="${PG_VER:-16}"
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

# 2. Neon local WebSocket proxy (skip if already listening) --------------------
PROXY_PORT="${NEON_LOCAL_PROXY_PORT:-5433}"
if ! curl -sf -o /dev/null "http://127.0.0.1:${PROXY_PORT}/" 2>/dev/null; then
  echo "==> Starting Neon local WebSocket proxy on :${PROXY_PORT}"
  nohup bun run scripts/neon-local-proxy.ts > /tmp/neon-local-proxy.log 2>&1 &
fi

echo "==> start complete"
