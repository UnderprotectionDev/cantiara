#!/usr/bin/env bash
# Shared Cloud Agent env hygiene. Sourced from install.sh and start.sh.
#
# Cursor Secrets win over dotenv. A leftover NEON_LOCAL=true in .env would still
# tunnel hosted Neon through the local proxy, so drop that flag when DATABASE_URL
# is already a hosted URL. Public URL keys get localhost fallbacks when missing.
# GitHub placeholders let the API boot before OAuth secrets exist; real
# GITHUB_CLIENT_* values stay in process.env.

cantiara_is_hosted_database() {
  [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" != *127.0.0.1* && "${DATABASE_URL}" != *localhost* ]]
}

cantiara_ensure_env_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
    return
  fi
  mkdir -p "$(dirname "$file")"
  echo "${key}=${value}" >> "$file"
}

cantiara_prepare_server_env() {
  local env_file="${1:-$REPO_ROOT/apps/server/.env}"
  if cantiara_is_hosted_database && [[ -f "$env_file" ]]; then
    if grep -q '^NEON_LOCAL=' "$env_file"; then
      log "Clearing NEON_LOCAL so Cursor DATABASE_URL reaches hosted Neon"
      grep -v '^NEON_LOCAL=' "$env_file" > "$env_file.tmp"
      mv "$env_file.tmp" "$env_file"
    fi
    if grep -q '^DATABASE_URL=' "$env_file"; then
      log "Clearing .env DATABASE_URL so the injected hosted URL is the only app target"
      grep -v '^DATABASE_URL=' "$env_file" > "$env_file.tmp"
      mv "$env_file.tmp" "$env_file"
    fi
  fi
  if [[ -f "$env_file" ]]; then
    if [[ -z "${GITHUB_CLIENT_ID:-}" ]] && ! grep -q '^GITHUB_CLIENT_ID=' "$env_file"; then
      echo 'GITHUB_CLIENT_ID=github-oauth-app-client-id' >> "$env_file"
    fi
    if [[ -z "${GITHUB_CLIENT_SECRET:-}" ]] && ! grep -q '^GITHUB_CLIENT_SECRET=' "$env_file"; then
      echo 'GITHUB_CLIENT_SECRET=github-oauth-app-client-secret' >> "$env_file"
    fi
  fi
  cantiara_ensure_env_key "$env_file" BETTER_AUTH_URL "http://localhost:3000"
  cantiara_ensure_env_key "$env_file" CORS_ORIGIN "http://localhost:3001"
  cantiara_ensure_env_key "$env_file" NODE_ENV "development"
  if [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
    cantiara_ensure_env_key "$env_file" BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
  fi
  cantiara_ensure_env_key "$REPO_ROOT/apps/web/.env" VITE_SERVER_URL "http://localhost:3000"
}
