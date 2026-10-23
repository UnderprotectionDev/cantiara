#!/usr/bin/env bash
# Installs Playwright browsers with their system dependencies on a CI runner.
# The Azure apt mirror served browser dependencies at about one package per
# several minutes and consumed the whole job timeout, so use the primary Ubuntu
# archive. A timed out attempt leaves apt-get holding the dpkg lock; stop it
# before the next attempt.
set -uo pipefail

echo 'Acquire::Retries "3";' | sudo tee /etc/apt/apt.conf.d/80-retries >/dev/null
echo 'http://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null

for attempt in 1 2; do
  timeout 420 bunx playwright install --with-deps "$@" && exit 0
  echo "Playwright install attempt $attempt did not finish"
  sudo pkill -x apt-get || true
  sudo pkill -x dpkg || true
  sleep 5
  sudo dpkg --configure -a || true
done
exit 1
