#!/usr/bin/env bash
# ARCA SENTRY installer for Linux (Ubuntu 22.04+ / Debian 12+, x86_64 or arm64).
# Idempotent. Safe to re-run.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SERVICE_USER="${SERVICE_USER:-$USER}"
VENV_DIR="${PROJECT_DIR}/.venv"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { bold "→ $*"; }

step "Detecting system"
. /etc/os-release
echo "  OS:   ${PRETTY_NAME}"
echo "  Arch: $(uname -m)"
echo "  User: ${SERVICE_USER}"
echo "  Dir:  ${PROJECT_DIR}"

step "Installing system packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    build-essential curl ca-certificates \
    python3-pip python3-venv python3-dev \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
    fonts-dejavu

step "Creating venv"
python3 -m venv "${VENV_DIR}"
"${VENV_DIR}/bin/pip" install -q -U pip setuptools wheel

step "Installing arca-sentry"
cd "${PROJECT_DIR}"
"${VENV_DIR}/bin/pip" install -e ".[dev]"

step "Preparing var/ for event store"
mkdir -p "${PROJECT_DIR}/var" "${PROJECT_DIR}/logs"

step "Installing systemd units"
SYSTEMD_DIR="/etc/systemd/system"
for unit in deploy/systemd/*.service; do
    base=$(basename "$unit")
    sudo tee "${SYSTEMD_DIR}/${base}" > /dev/null < <(
        sed \
          -e "s|@PROJECT_DIR@|${PROJECT_DIR}|g" \
          -e "s|@USER@|${SERVICE_USER}|g" \
          "${unit}"
    )
done
sudo systemctl daemon-reload

step "Enabling services (not started yet — fill .env first)"
sudo systemctl enable arca-sentry-api.service
sudo systemctl enable arca-sentry-capture.service
sudo systemctl enable arca-sentry-voice.service

cat <<EOF

✓ Installation complete.

Next steps:
  1. cp .env.example .env  &&  edit .env with API keys
  2. sudo systemctl start arca-sentry-api
  3. sudo systemctl start arca-sentry-capture
  4. sudo systemctl start arca-sentry-voice
  5. curl http://localhost:8088/health
  6. open http://<this-host>:8088/dashboard

Logs: journalctl -u arca-sentry-api -f
EOF
