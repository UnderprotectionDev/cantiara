#!/usr/bin/env bash
# Cloud Agent start phase for cantiara.
#
# Runs on every boot. Brings the local Postgres cluster online and reconciles
# the schema, then returns. The Neon WebSocket proxy and dev servers run as
# persistent terminals, not here.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PG_MAJOR="16"
PG_CLUSTER="main"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

log() { printf '\n[start] %s\n' "$*"; }

if ! sudo pg_lsclusters -h 2>/dev/null | grep -q "^${PG_MAJOR}[[:space:]]\+${PG_CLUSTER}\b.*online"; then
  log "Starting PostgreSQL cluster ${PG_MAJOR}/${PG_CLUSTER}"
  sudo pg_ctlcluster "$PG_MAJOR" "$PG_CLUSTER" start
fi

log "Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    break
  fi
  sleep 1
done

# Reconcile the schema in case the persisted data directory predates a schema
# change. `db push` is a no-op when the database is already in sync.
log "Reconciling Prisma schema"
(cd packages/db && bunx prisma db push)

log "Start complete"
