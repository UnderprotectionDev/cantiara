#!/usr/bin/env bash
# Drop leftover web/API listeners from a Cloud Agent snapshot so the next
# `bun run dev` loads the Prisma client that `prisma generate` just wrote.
set -euo pipefail

collect_listener_pids() {
	local port="$1"
	lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

pids=()
for port in 3000 3001 4000; do
	while read -r pid; do
		if [[ -n "$pid" ]]; then
			pids+=("$pid")
		fi
	done < <(collect_listener_pids "$port")
done

while read -r pid; do
	if [[ -n "$pid" ]]; then
		pids+=("$pid")
	fi
done < <(pgrep -x turbo 2>/dev/null || true)

if [[ "${#pids[@]}" -eq 0 ]]; then
	exit 0
fi

unique_pids=$(printf '%s\n' "${pids[@]}" | sort -u)
while read -r pid; do
	if [[ -n "$pid" ]] && [[ -d "/proc/$pid" ]]; then
		kill "$pid" 2>/dev/null || true
	fi
done <<<"$unique_pids"

for _ in {1..20}; do
	busy=0
	for port in 3000 3001 4000; do
		if [[ -n "$(collect_listener_pids "$port")" ]]; then
			busy=1
			break
		fi
	done
	if [[ "$busy" -eq 0 ]]; then
		exit 0
	fi
	sleep 0.25
done

while read -r pid; do
	if [[ -n "$pid" ]] && [[ -d "/proc/$pid" ]]; then
		kill -KILL "$pid" 2>/dev/null || true
	fi
done <<<"$unique_pids"
