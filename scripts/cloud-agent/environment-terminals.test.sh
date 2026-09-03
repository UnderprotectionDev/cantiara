#!/usr/bin/env bash
# Cloud Agent expands $(...) in environment.json terminal commands, then types
# the result into an interactive bash. A substitution that emits a newline
# (for example `seq 1 90`) splits the command and the servers never bind.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.cursor/environment.json"

if ! command -v python3 >/dev/null 2>&1; then
	printf 'FAIL python3 is required to read environment.json\n' >&2
	exit 1
fi

python3 - "$ENV_FILE" <<'PY'
import json
import re
import subprocess
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)

pattern = re.compile(r"\$\(([^)]+)\)")
failed = False

for terminal in data.get("terminals", []):
    name = terminal.get("name", "<unnamed>")
    command = terminal.get("command", "")
    for inner in pattern.findall(command):
        output = subprocess.check_output(["bash", "-lc", inner], text=True)
        # Bash command substitution strips one trailing newline and keeps the rest.
        if output.endswith("\n"):
            output = output[:-1]
        if "\n" in output:
            print(
                f"FAIL {name}: $({inner}) expands to a newline; "
                "Cloud Agent types that into interactive bash and the terminal dies",
                file=sys.stderr,
            )
            failed = True

required_ports = {3000, 3001, 4000, 5432, 5433}
declared = {item.get("port") for item in data.get("ports") or []}
missing = sorted(required_ports - declared)
if missing:
    print(
        f"FAIL ports {missing} missing from .cursor/environment.json; "
        "Cloud Agent will not keep them forwarded",
        file=sys.stderr,
    )
    failed = True

if failed:
    sys.exit(1)

print("ok")
PY
