#!/bin/bash
# =============================================================================
# install_deps.sh — Bootstrap a fresh VPS for KiloCode deployment
# Run on the VPS as root (or with sudo).
# Usage: bash deploy/scripts/install_deps.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[install]${RESET} $*"; }
success() { echo -e "${GREEN}[  OK  ]${RESET} $*"; }
error()   { echo -e "${RED}[ ERR  ]${RESET} $*" >&2; }

if [[ "$EUID" -ne 0 ]]; then
  error "This script must be run as root (or via sudo)"
  exit 1
fi

DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# 1. System update
# ---------------------------------------------------------------------------
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
success "System packages updated"

# ---------------------------------------------------------------------------
# 2. Ensure Python 3 with venv (Ubuntu 24.04 ships 3.12)
# ---------------------------------------------------------------------------
info "Checking Python 3..."

PY=$(command -v python3.12 || command -v python3.11 || command -v python3)
if [[ -z "$PY" ]]; then
  apt-get install -y -qq python3 python3-venv python3-pip
  PY=$(command -v python3)
fi

# Ensure venv module available
PY_VER=$("$PY" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
apt-get install -y -qq "python${PY_VER}-venv" 2>/dev/null || true
apt-get install -y -qq python3-pip 2>/dev/null || true

success "Python ready: $($PY --version) at $PY"
export PYTHON="$PY"

# ---------------------------------------------------------------------------
# 3. Install Nginx
# ---------------------------------------------------------------------------
info "Installing Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
success "Nginx installed: $(nginx -v 2>&1)"

# ---------------------------------------------------------------------------
# 4. Install NATS server
# ---------------------------------------------------------------------------
info "Installing NATS server..."

NATS_VERSION="${NATS_VERSION:-2.10.14}"
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  NATS_ARCH="amd64" ;;
  aarch64) NATS_ARCH="arm64" ;;
  armv7l)  NATS_ARCH="arm6"  ;;
  *)       NATS_ARCH="amd64" ;;
esac

NATS_URL="https://github.com/nats-io/nats-server/releases/download/v${NATS_VERSION}/nats-server-v${NATS_VERSION}-linux-${NATS_ARCH}.tar.gz"
NATS_TMP=$(mktemp -d)

if ! command -v nats-server &>/dev/null; then
  info "  Downloading NATS ${NATS_VERSION} (${NATS_ARCH})..."
  curl -sSL "$NATS_URL" -o "$NATS_TMP/nats.tar.gz"
  tar -xzf "$NATS_TMP/nats.tar.gz" -C "$NATS_TMP"
  install -m 0755 "$NATS_TMP/nats-server-v${NATS_VERSION}-linux-${NATS_ARCH}/nats-server" \
    /usr/local/bin/nats-server
  rm -rf "$NATS_TMP"

  # Create systemd unit for NATS
  cat > /etc/systemd/system/nats.service <<'NATS_UNIT'
[Unit]
Description=NATS Message Broker
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/nats-server -js -m 8222
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nats

[Install]
WantedBy=multi-user.target
NATS_UNIT

  systemctl daemon-reload
  systemctl enable nats
  systemctl start nats
  success "NATS server installed: $(nats-server --version)"
else
  info "  NATS already installed: $(nats-server --version)"
fi

# ---------------------------------------------------------------------------
# 5. Create kilocode system user
# ---------------------------------------------------------------------------
info "Creating kilocode system user..."

if ! id -u kilocode &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin kilocode
  success "User 'kilocode' created"
else
  info "  User 'kilocode' already exists"
fi

# ---------------------------------------------------------------------------
# 6. Create directory structure
# ---------------------------------------------------------------------------
info "Creating /opt/kilocode directory structure..."
mkdir -p /opt/kilocode/{src,data,logs,configs,venv}
chown -R kilocode:kilocode /opt/kilocode
chmod 750 /opt/kilocode
success "Directories ready"

# ---------------------------------------------------------------------------
# 7. Create and populate Python venv
# ---------------------------------------------------------------------------
REQUIREMENTS="/opt/kilocode/requirements.txt"

info "Setting up Python virtual environment..."
if [[ ! -f /opt/kilocode/venv/bin/activate ]]; then
  "${PYTHON:-python3}" -m venv /opt/kilocode/venv
  chown -R kilocode:kilocode /opt/kilocode/venv
fi

if [[ -f "$REQUIREMENTS" ]]; then
  info "Installing Python requirements..."
  /opt/kilocode/venv/bin/pip install --upgrade pip --quiet
  /opt/kilocode/venv/bin/pip install -r "$REQUIREMENTS" --quiet
  PKG_COUNT=$(/opt/kilocode/venv/bin/pip list | wc -l)
  success "Python venv ready — ${PKG_COUNT} packages installed"
else
  info "  requirements.txt not yet present — run deploy.sh to upload and install"
fi

# ---------------------------------------------------------------------------
# 8. Install Certbot (Let's Encrypt) — optional
# ---------------------------------------------------------------------------
info "Installing Certbot for SSL..."
if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
  success "Certbot installed: $(certbot --version 2>&1)"
else
  info "  Certbot already installed"
fi

# ---------------------------------------------------------------------------
# 9. Firewall (ufw)
# ---------------------------------------------------------------------------
info "Configuring firewall (ufw)..."
if command -v ufw &>/dev/null; then
  ufw --force enable 2>/dev/null || true
  ufw allow OpenSSH    2>/dev/null || true
  ufw allow 'Nginx Full' 2>/dev/null || true
  ufw allow 4222/tcp   2>/dev/null || true   # NATS (internal — tighten if needed)
  success "Firewall configured"
else
  info "  ufw not available — skipping firewall setup"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=== Dependency installation complete ===${RESET}"
echo "  Python   : $(${PYTHON:-python3} --version)"
echo "  pip      : $(/opt/kilocode/venv/bin/pip --version | awk '{print $2}')"
echo "  Nginx    : $(nginx -v 2>&1 | awk '{print $3}')"
echo "  NATS     : $(nats-server --version 2>&1)"
echo "  Certbot  : $(certbot --version 2>&1 | awk '{print $2}')"
echo ""
echo "Next step: run deploy/deploy.sh from your local machine."
