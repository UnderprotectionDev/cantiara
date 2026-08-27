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

# shellcheck source=prepare-app-env.sh
source "$REPO_ROOT/scripts/cloud-agent/prepare-app-env.sh"

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

cantiara_prepare_server_env
if cantiara_is_hosted_database; then
	unset NEON_LOCAL
	unset NEON_LOCAL_PROXY
fi

# Warm-fork snapshots skip install.sh. Overlayed schema (AccountPreference and
# later models) must regenerate the client before the API boots, or protected
# RPC handlers throw Internal server error.
log "Generating Prisma client"
bash "$REPO_ROOT/scripts/cloud-agent/prisma-generate.sh" >/dev/null

# Reconcile the local throwaway cluster only. Hosted Neon is not a `db push`
# target; dotenv will not override this explicit local URL.
log "Reconciling Prisma schema on local Postgres"
(
  cd packages/db
  DATABASE_URL="postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara" bunx prisma db push
)

log "Start complete"
