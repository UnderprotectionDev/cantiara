#!/usr/bin/env bash
# Idempotent Cloud Agent install step for cantiara.
#
# Prepares a fully local development environment: pinned Bun, a local PostgreSQL
# server, workspace dependencies, local .env files, and the database schema.
# The app uses the Neon serverless driver (WebSocket transport), so runtime DB
# access is tunnelled to local Postgres via scripts/neon-local-proxy.ts, started
# in .cursor/start.sh. No Neon cloud account or secret is required.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUN_VERSION="1.3.13"
DATABASE_URL="postgresql://cantiara:cantiara@localhost:5432/cantiara"

# 1. Bun (pinned) --------------------------------------------------------------
if [ ! -x "$HOME/.bun/bin/bun" ]; then
  echo "==> Installing Bun ${BUN_VERSION}"
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# 2. PostgreSQL (system package) ----------------------------------------------
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "==> Installing PostgreSQL"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi
PG_VER="$(pg_lsclusters -h 2>/dev/null | awk 'NR==1{print $1}')"
PG_VER="${PG_VER:-16}"

# 3. Workspace dependencies ----------------------------------------------------
# A DATABASE_URL is exported so the @cantiara/db postinstall (prisma generate)
# succeeds even before the .env files exist.
echo "==> Installing dependencies"
DATABASE_URL="$DATABASE_URL" bun install --frozen-lockfile

# 4. Local environment files (never overwrite existing) ------------------------
if [ ! -f apps/server/.env ]; then
  echo "==> Writing apps/server/.env"
  cat > apps/server/.env <<EOF
DATABASE_URL=${DATABASE_URL}
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development
NEON_LOCAL=true
NEON_LOCAL_PROXY=127.0.0.1:5433
EOF
fi
if [ ! -f apps/web/.env ]; then
  echo "==> Writing apps/web/.env"
  echo "VITE_SERVER_URL=http://localhost:3000" > apps/web/.env
fi

# 5. PostgreSQL role, database, and schema ------------------------------------
echo "==> Starting PostgreSQL ${PG_VER}/main"
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "==> Ensuring role and database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cantiara') THEN
    CREATE ROLE cantiara LOGIN PASSWORD 'cantiara';
  END IF;
END $$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'cantiara'" | grep -q 1; then
  sudo -u postgres createdb -O cantiara cantiara
fi

echo "==> Syncing Prisma schema"
( cd packages/db && bunx prisma db push )

echo "==> install complete"
