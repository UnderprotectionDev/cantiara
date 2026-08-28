#!/usr/bin/env bash
# Red when Inline reference would toast "Not Found": the usage write RPC is unmatched.
# Green when the procedure exists (401 without a session, or 2xx/4xx JSON with a session).
set -euo pipefail
base="${1:-http://127.0.0.1:3000}"
path="/rpc/relations/createUsageLink"
code="$(curl -sS -o /tmp/inline-reference-rpc.body -w '%{http_code}' -X POST "${base}${path}" \
	-H 'content-type: application/json' \
	-d '{"hostRecordId":"probe","idempotencyKey":"probe","kind":"inline-record-reference","sourceRecordId":"probe"}')"
body="$(head -c 200 /tmp/inline-reference-rpc.body | tr '\n' ' ')"
echo "HTTP ${code}"
echo "${body}"
if [[ "${code}" == "404" ]]; then
	echo "RED: ${path} unmatched — toast title Not Found"
	exit 1
fi
echo "GREEN: ${path} is registered"
exit 0
