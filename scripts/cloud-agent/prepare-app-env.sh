#!/usr/bin/env bash
# Shared Cloud Agent env hygiene. Sourced from install.sh and start.sh.
#
# Cursor Secrets win over dotenv. A leftover NEON_LOCAL=true in .env would still
# tunnel hosted Neon through the local proxy, so drop that flag when DATABASE_URL
# is already a hosted URL. GitHub placeholders let the API boot before OAuth
# secrets exist; real GITHUB_CLIENT_* values stay in process.env.

cantiara_is_hosted_database() {
  [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" != *127.0.0.1* && "${DATABASE_URL}" != *localhost* ]]
}

cantiara_prepare_server_env() {
  local env_file="${1:-$REPO_ROOT/apps/server/.env}"
  if cantiara_is_hosted_database && [[ -f "$env_file" ]] && grep -q '^NEON_LOCAL=' "$env_file"; then
    log "Clearing NEON_LOCAL so Cursor DATABASE_URL reaches hosted Neon"
    grep -v '^NEON_LOCAL=' "$env_file" > "$env_file.tmp"
    mv "$env_file.tmp" "$env_file"
  fi
  if [[ -f "$env_file" ]]; then
    if ! grep -q '^GITHUB_CLIENT_ID=' "$env_file"; then
      echo 'GITHUB_CLIENT_ID=github-oauth-app-client-id' >> "$env_file"
    fi
    if ! grep -q '^GITHUB_CLIENT_SECRET=' "$env_file"; then
      echo 'GITHUB_CLIENT_SECRET=github-oauth-app-client-secret' >> "$env_file"
    fi
  fi
}
