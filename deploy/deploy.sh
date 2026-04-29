#!/bin/bash
# =============================================================================
# deploy.sh — One-shot production deployment for contract-kit-v17
# Target VPS: 187.77.30.206
# Usage: bash deploy/deploy.sh [--user ubuntu|root]
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VPS_HOST="187.77.30.206"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_BASE="/opt/kilocode"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"

# Parse args
for arg in "$@"; do
  case $arg in
    --user=*) VPS_USER="${arg#*=}" ;;
    --user)   shift; VPS_USER="$1" ;;
  esac
done

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o BatchMode=yes"
SCP_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[deploy]${RESET} $*"; }
success() { echo -e "${GREEN}[  OK  ]${RESET} $*"; }
error()   { echo -e "${RED}[ ERR  ]${RESET} $*" >&2; }

# ---------------------------------------------------------------------------
# Step 0 — Sanity checks (local)
# ---------------------------------------------------------------------------
info "Step 0: Local sanity checks..."

if [[ ! -f "$SSH_KEY" ]]; then
  error "SSH key not found at $SSH_KEY"
  error "Set SSH_KEY=/path/to/key or place key at ~/.ssh/id_ed25519"
  exit 1
fi

if ! ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" "echo ok" &>/dev/null; then
  error "Cannot SSH to ${VPS_USER}@${VPS_HOST} with key $SSH_KEY"
  exit 1
fi
success "SSH connection verified"

# ---------------------------------------------------------------------------
# Step 1 — Create directory structure on VPS
# ---------------------------------------------------------------------------
info "Step 1: Creating directory structure on VPS..."

ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE_MKDIR'
set -e
mkdir -p /opt/kilocode/{src,data,logs,configs,venv}
mkdir -p /opt/kilocode/src/{runtime,hermes,zeroclaw,webui,kilocode,proof,blockchain_audit}
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/systemd/system
echo "Directories ready"
REMOTE_MKDIR

success "Directory structure created"

# ---------------------------------------------------------------------------
# Step 2 — Upload tar.gz packages
# ---------------------------------------------------------------------------
info "Step 2: Uploading deployment packages..."

PACKAGES_DIR="$DEPLOY_DIR/packages"

if [[ -d "$PACKAGES_DIR" ]] && ls "$PACKAGES_DIR"/*.tar.gz &>/dev/null 2>&1; then
  for pkg in "$PACKAGES_DIR"/*.tar.gz; do
    pkg_name="$(basename "$pkg")"
    info "  Uploading $pkg_name..."
    scp $SCP_OPTS "$pkg" "${VPS_USER}@${VPS_HOST}:${REMOTE_BASE}/"
    ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" \
      "cd ${REMOTE_BASE} && tar -xzf ${pkg_name} && rm ${pkg_name}"
    success "  $pkg_name extracted"
  done
else
  info "  No packages found in $PACKAGES_DIR — uploading source tree directly..."
  # Fallback: rsync source
  if command -v rsync &>/dev/null; then
    rsync -az --exclude '__pycache__' --exclude '*.pyc' --exclude '.git' \
      -e "ssh $SSH_OPTS" \
      "$PROJECT_ROOT/src/" \
      "${VPS_USER}@${VPS_HOST}:${REMOTE_BASE}/src/"
    rsync -az -e "ssh $SSH_OPTS" \
      "$PROJECT_ROOT/requirements.txt" \
      "${VPS_USER}@${VPS_HOST}:${REMOTE_BASE}/requirements.txt"
    success "Source tree synced via rsync"
  else
    # Last resort: tar-pipe
    tar -czf - -C "$PROJECT_ROOT" src requirements.txt \
      | ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" "tar -xzf - -C ${REMOTE_BASE}"
    success "Source tree uploaded via tar-pipe"
  fi
fi

# ---------------------------------------------------------------------------
# Step 3 — Upload requirements.txt and install Python deps
# ---------------------------------------------------------------------------
info "Step 3: Installing Python dependencies..."

scp $SCP_OPTS "$PROJECT_ROOT/requirements.txt" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_BASE}/requirements.txt"

ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" bash <<REMOTE_PIP
set -e
cd ${REMOTE_BASE}

# Bootstrap venv if absent
if [[ ! -f venv/bin/activate ]]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "Python deps installed: \$(pip list | wc -l) packages"
REMOTE_PIP

success "Python dependencies installed"

# ---------------------------------------------------------------------------
# Step 4 — Copy systemd service files
# ---------------------------------------------------------------------------
info "Step 4: Installing systemd service files..."

for svc in "$DEPLOY_DIR/systemd/"*.service; do
  svc_name="$(basename "$svc")"
  scp $SCP_OPTS "$svc" "${VPS_USER}@${VPS_HOST}:/etc/systemd/system/${svc_name}"
  success "  Installed /etc/systemd/system/$svc_name"
done

# ---------------------------------------------------------------------------
# Step 5 — Copy Nginx config
# ---------------------------------------------------------------------------
info "Step 5: Installing Nginx configuration..."

scp $SCP_OPTS "$DEPLOY_DIR/nginx/kilocode.conf" \
  "${VPS_USER}@${VPS_HOST}:/etc/nginx/sites-available/kilocode.conf"

ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE_NGINX'
set -e
# Enable site
ln -sf /etc/nginx/sites-available/kilocode.conf \
        /etc/nginx/sites-enabled/kilocode.conf
# Remove default if present
rm -f /etc/nginx/sites-enabled/default
# Test config
nginx -t
REMOTE_NGINX

success "Nginx configuration installed and tested"

# ---------------------------------------------------------------------------
# Step 6 — Copy .env if present
# ---------------------------------------------------------------------------
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  info "Step 6: Uploading .env file..."
  scp $SCP_OPTS "$DEPLOY_DIR/.env" "${VPS_USER}@${VPS_HOST}:${REMOTE_BASE}/.env"
  success ".env uploaded"
else
  info "Step 6: No .env found — skipping (copy deploy/.env.example to deploy/.env and fill values)"
fi

# ---------------------------------------------------------------------------
# Step 7 — Reload systemd, enable and start services
# ---------------------------------------------------------------------------
info "Step 7: Enabling and starting services..."

ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE_SYSTEMD'
set -e
systemctl daemon-reload

SERVICES=(kilocode-runtime kilocode-hermes kilocode-webui)

for svc in "${SERVICES[@]}"; do
  systemctl enable "$svc"
  systemctl restart "$svc"
  sleep 1
  if systemctl is-active --quiet "$svc"; then
    echo "  [OK]  $svc is running"
  else
    echo "  [ERR] $svc failed to start — check: journalctl -u $svc -n 30"
  fi
done

# Reload nginx
systemctl reload nginx || systemctl restart nginx
echo "  [OK]  nginx reloaded"
REMOTE_SYSTEMD

success "Services started"

# ---------------------------------------------------------------------------
# Step 8 — Health check
# ---------------------------------------------------------------------------
info "Step 8: Running health checks..."

ssh $SSH_OPTS "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE_HEALTH'
GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
PASS=0; FAIL=0

check_service() {
  local name=$1
  if systemctl is-active --quiet "$name"; then
    echo -e "  ${GREEN}[PASS]${RESET} systemd: $name"
    ((PASS++)) || true
  else
    echo -e "  ${RED}[FAIL]${RESET} systemd: $name"
    ((FAIL++)) || true
  fi
}

check_http() {
  local name=$1 url=$2
  if curl -sf "$url" -o /dev/null --max-time 5; then
    echo -e "  ${GREEN}[PASS]${RESET} http:    $name ($url)"
    ((PASS++)) || true
  else
    echo -e "  ${RED}[FAIL]${RESET} http:    $name ($url)"
    ((FAIL++)) || true
  fi
}

echo ""
echo "=== Service status ==="
check_service kilocode-runtime
check_service kilocode-hermes
check_service kilocode-webui
check_service nginx

echo ""
echo "=== HTTP endpoints ==="
sleep 3  # let services settle
check_http "Runtime  /health" "http://localhost:8080/health"
check_http "Hermes   /health" "http://localhost:8090/health"
check_http "WebUI    /"       "http://localhost:7860/"

echo ""
echo "=== Summary: ${PASS} passed, ${FAIL} failed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
REMOTE_HEALTH

HEALTH_EXIT=$?

if [[ $HEALTH_EXIT -eq 0 ]]; then
  success "All health checks passed"
  echo ""
  echo -e "${GREEN}Deployment complete!${RESET}"
  echo "  Runtime API : http://${VPS_HOST}:8080"
  echo "  Hermes      : http://${VPS_HOST}:8090"
  echo "  WebUI       : http://${VPS_HOST}:7860"
  echo "  Public site : https://daveai.tech"
else
  error "Some health checks failed — review logs on VPS:"
  error "  journalctl -u kilocode-runtime -n 50"
  error "  journalctl -u kilocode-hermes  -n 50"
  error "  journalctl -u kilocode-webui   -n 50"
  exit 1
fi
