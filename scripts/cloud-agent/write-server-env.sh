#!/usr/bin/env bash
# Materialize apps/server/.env for Cloud Agents.
#
# Cursor injects Secrets as environment variables. This script copies them into
# the gitignored server env file the app actually loads. Hosted Neon URLs leave
# NEON_LOCAL unset. Local fallback still uses the neon-local-proxy path.
#
# Never prints secret values.
set -euo pipefail

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara}"

database_url_is_local() {
	local url="${1:-}"
	[[ "$url" == *"127.0.0.1"* || "$url" == *"localhost"* ]]
}

hosted_database_url_from_env() {
	if [[ -n "${DATABASE_URL:-}" ]] && ! database_url_is_local "$DATABASE_URL"; then
		printf '%s' "$DATABASE_URL"
		return 0
	fi
	return 1
}

write_kv() {
	printf '%s=%s\n' "$1" "$2"
}

write_server_env() {
	local dest="${1:-apps/server/.env}"
	local dest_dir
	dest_dir="$(dirname "$dest")"
	mkdir -p "$dest_dir"

	local database_url neon_local secret
	local github_client_id="${GITHUB_CLIENT_ID:-}"
	local github_client_secret="${GITHUB_CLIENT_SECRET:-}"
	local auth_url="${BETTER_AUTH_URL:-http://localhost:3000}"
	local cors_origin="${CORS_ORIGIN:-http://localhost:3001}"
	local node_env="${NODE_ENV:-development}"

	if database_url="$(hosted_database_url_from_env)"; then
		neon_local=""
	else
		database_url="$LOCAL_DATABASE_URL"
		neon_local="true"
	fi

	if [[ -n "${BETTER_AUTH_SECRET:-}" ]]; then
		secret="$BETTER_AUTH_SECRET"
	else
		secret="$(openssl rand -base64 32)"
	fi

	local umask_old
	umask_old="$(umask)"
	umask 077
	{
		write_kv DATABASE_URL "$database_url"
		if [[ -n "$neon_local" ]]; then
			write_kv NEON_LOCAL "$neon_local"
		fi
		write_kv BETTER_AUTH_SECRET "$secret"
		write_kv BETTER_AUTH_URL "$auth_url"
		write_kv CORS_ORIGIN "$cors_origin"
		if [[ -n "$github_client_id" ]]; then
			write_kv GITHUB_CLIENT_ID "$github_client_id"
		fi
		if [[ -n "$github_client_secret" ]]; then
			write_kv GITHUB_CLIENT_SECRET "$github_client_secret"
		fi
		write_kv NODE_ENV "$node_env"
	} >"$dest"
	umask "$umask_old"
}

should_write_server_env() {
	local dest="${1:-apps/server/.env}"
	if [[ ! -f "$dest" ]]; then
		return 0
	fi
	if hosted_database_url_from_env >/dev/null; then
		return 0
	fi
	return 1
}

apply_server_env() {
	local dest="${1:-apps/server/.env}"
	if should_write_server_env "$dest"; then
		write_server_env "$dest"
		if hosted_database_url_from_env >/dev/null; then
			printf 'hosted-neon\n'
		else
			printf 'local-postgres\n'
		fi
	else
		printf 'kept\n'
	fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	apply_server_env "${1:-apps/server/.env}"
fi
