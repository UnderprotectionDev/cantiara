#!/usr/bin/env bash

set -euo pipefail

DEV_PORTS=("$@")
if [[ "${#DEV_PORTS[@]}" -eq 0 ]]; then
  DEV_PORTS=(3000 3001 4000)
fi
busy=0

for port in "${DEV_PORTS[@]}"; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    continue
  fi

  busy=1
  while IFS= read -r pid; do
    process="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    printf 'Port %s is already used by PID %s (%s)\n' "$port" "$pid" "${process:-unknown}"
    if [[ -n "$cwd" ]]; then
      printf '  Working directory: %s\n' "$cwd"
    fi
  done <<< "$pids"
done

if [[ "$busy" -ne 0 ]]; then
  printf '\nStop the existing dev run, then start this workspace again.\n' >&2
  exit 1
fi
