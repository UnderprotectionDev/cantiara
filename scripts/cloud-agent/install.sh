#!/usr/bin/env bash
# Cloud Agent install phase for cantiara.
#
# Idempotent, non-interactive repository bootstrap that can run against a clean
# base image or a warm snapshot. It provisions the pinned toolchain, installs
# workspace dependencies, generates the Prisma client, and makes sure a local
# Postgres cluster holds the current schema. Long-running services (the Neon
# WebSocket proxy and the dev servers) are started elsewhere, not here.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

BUN_VERSION="1.3.13"
PG_MAJOR="16"
PG_CLUSTER="main"
DB_USER="cantiara"
DB_PASSWORD="cantiara"
DB_NAME="cantiara"

log() { printf '\n[install] %s\n' "$*"; }

# shellcheck source=prepare-app-env.sh
source "$REPO_ROOT/scripts/cloud-agent/prepare-app-env.sh"

# --- Bun (pinned) -----------------------------------------------------------
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun >/dev/null 2>&1 || [[ "$(bun --version 2>/dev/null)" != "$BUN_VERSION" ]]; then
  log "Installing Bun $BUN_VERSION"
  curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION"
fi
log "Bun $(bun --version)"

# --- PostgreSQL server ------------------------------------------------------
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  log "Installing PostgreSQL $PG_MAJOR"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

if ! sudo pg_lsclusters -h 2>/dev/null | grep -q "^${PG_MAJOR}[[:space:]]\+${PG_CLUSTER}\b"; then
  log "Creating PostgreSQL cluster ${PG_MAJOR}/${PG_CLUSTER}"
  sudo pg_createcluster "$PG_MAJOR" "$PG_CLUSTER"
fi

if ! sudo pg_lsclusters -h 2>/dev/null | grep -q "^${PG_MAJOR}[[:space:]]\+${PG_CLUSTER}\b.*online"; then
  log "Starting PostgreSQL cluster"
  sudo pg_ctlcluster "$PG_MAJOR" "$PG_CLUSTER" start
fi

log "Ensuring database role and database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}' CREATEDB;
  END IF;
END
\$\$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

# --- Local environment files ------------------------------------------------
# Cursor Secrets are process env vars. dotenv does not override them.
hosted_database=0
if cantiara_is_hosted_database; then
  hosted_database=1
fi

if [[ ! -f apps/server/.env ]]; then
  log "Writing apps/server/.env"
  {
    if [[ "${hosted_database}" -eq 0 ]]; then
      echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
      echo "NEON_LOCAL=true"
      echo "BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-$(openssl rand -base64 32)}"
    elif [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
      echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
    fi
    echo "BETTER_AUTH_URL=${BETTER_AUTH_URL:-http://localhost:3000}"
    echo "CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3001}"
    echo "NODE_ENV=development"
    echo "GITHUB_CLIENT_ID=github-oauth-app-client-id"
    echo "GITHUB_CLIENT_SECRET=github-oauth-app-client-secret"
  } > apps/server/.env
fi
cantiara_prepare_server_env
if [[ ! -f apps/web/.env ]]; then
  log "Writing apps/web/.env"
  echo "VITE_SERVER_URL=http://localhost:3000" > apps/web/.env
fi

# --- Workspace dependencies + Prisma client ---------------------------------
log "Installing workspace dependencies"
bun install --frozen-lockfile

# postinstall runs `prisma generate`, but regenerate explicitly so a warm
# snapshot without the generated client is still repaired. Call Prisma directly
# because the turbo wrapper task is interactive and needs a TTY.
log "Generating Prisma client"
(cd packages/db && bunx prisma generate >/dev/null)

# --- Schema sync ------------------------------------------------------------
# Always the local throwaway cluster, even when the app .env points at hosted
# Neon. `db push` must not run against the product database.
log "Syncing Prisma schema to local Postgres"
(
  cd packages/db
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}" bunx prisma db push
)

log "Install complete"
