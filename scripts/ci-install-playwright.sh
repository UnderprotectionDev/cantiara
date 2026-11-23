#!/usr/bin/env bash
# Installs Playwright browsers with their system dependencies on a CI runner.
# Keep the runner's apt mirror failover and download timeouts. A timed out
# attempt can leave apt-get holding the dpkg lock; stop it before retrying.
set -uo pipefail

for attempt in 1 2; do
  timeout 420 bunx playwright install --with-deps "$@" && exit 0
  echo "Playwright install attempt $attempt did not finish"
  sudo pkill -x apt-get || true
  sudo pkill -x dpkg || true
  sleep 5
  sudo dpkg --configure -a || true
done
exit 1
