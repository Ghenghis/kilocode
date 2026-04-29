#!/usr/bin/env bash
# _vps_deploy_hub.sh
# Deploy the full KiloCode Control Hub to VPS 187.77.30.206
# Run from: G:\Github\contract-kit-v17 (locally via SCP) or on VPS directly
#
# Services deployed:
#   kilocode-runtime  :8081   (runtime core)
#   kilocode-settings :8082   (canonical settings + audit)
#   kilocode-hermes   :8091   (hermes orchestrator)
#   kilocode-webui    :8095   (control hub dashboard)
#
# Usage (from Windows via WSL/Git Bash):
#   bash deploy/scripts/_vps_deploy_hub.sh
# Or copy to VPS first:
#   scp deploy/scripts/_vps_deploy_hub.sh root@187.77.30.206:/tmp/
#   ssh root@187.77.30.206 'bash /tmp/_vps_deploy_hub.sh'

set -euo pipefail
VPS="root@187.77.30.206"
DEPLOY_DIR="/opt/kilocode"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "═══════════════════════════════════════════════════"
echo " KiloCode Control Hub — VPS Deploy"
echo " Target: $VPS"
echo " Source: $REPO_ROOT"
echo "═══════════════════════════════════════════════════"

# ── 1. Sync source files ─────────────────────────────────────────────────────
echo "[1/6] Syncing source to VPS…"
rsync -avz --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' \
  "$REPO_ROOT/src/" "$VPS:$DEPLOY_DIR/src/"

echo "[1/6] Syncing deploy/systemd…"
rsync -avz "$REPO_ROOT/deploy/systemd/" "$VPS:/etc/systemd/system/"

echo "[1/6] Syncing static hub HTML…"
rsync -avz "$REPO_ROOT/src/webui/hub.html" "$VPS:$DEPLOY_DIR/src/webui/hub.html"

# ── 2. Ensure directories exist on VPS ──────────────────────────────────────
echo "[2/6] Ensuring VPS directories…"
ssh "$VPS" "mkdir -p $DEPLOY_DIR/data $DEPLOY_DIR/logs $DEPLOY_DIR/src/webui"

# ── 3. Install Python deps (if requirements.txt present) ────────────────────
echo "[3/6] Installing Python deps on VPS…"
ssh "$VPS" "
  cd $DEPLOY_DIR
  if [ -f requirements.txt ]; then
    $DEPLOY_DIR/venv/bin/pip install -q -r requirements.txt
  fi
  $DEPLOY_DIR/venv/bin/pip install -q fastapi uvicorn httpx pydantic
  echo 'Deps OK'
"

# ── 4. Open firewall ports ───────────────────────────────────────────────────
echo "[4/6] Opening firewall ports 8081 8082 8091 8095…"
ssh "$VPS" "
  for port in 8081 8082 8091 8095; do
    ufw allow \$port/tcp 2>/dev/null || iptables -I INPUT -p tcp --dport \$port -j ACCEPT 2>/dev/null || true
  done
  echo 'Firewall OK'
"

# ── 5. Reload systemd + restart services ────────────────────────────────────
echo "[5/6] Reloading systemd and restarting services…"
ssh "$VPS" "
  systemctl daemon-reload

  for svc in kilocode-runtime kilocode-settings kilocode-hermes kilocode-webui; do
    systemctl enable \$svc 2>/dev/null || true
    systemctl restart \$svc || echo \"WARNING: \$svc failed to start\"
  done

  echo 'Services restarted'
"

# ── 6. Health check ──────────────────────────────────────────────────────────
echo "[6/6] Health check (30s timeout per service)…"
ssh "$VPS" "
  check() {
    local svc=\$1 url=\$2 n=0
    until curl -sf \$url -o /dev/null 2>/dev/null; do
      n=\$((n+1))
      if [ \$n -ge 15 ]; then echo \"  FAIL: \$svc not reachable at \$url\"; return 1; fi
      sleep 2
    done
    echo \"  OK: \$svc at \$url\"
  }
  check 'kilocode-runtime'  http://localhost:8081/health
  check 'kilocode-settings' http://localhost:8082/health
  check 'kilocode-hermes'   http://localhost:8091/health
  check 'kilocode-webui'    http://localhost:8095/health
"

echo ""
echo "═══════════════════════════════════════════════════"
echo " DEPLOY COMPLETE"
echo "  Dashboard : http://187.77.30.206:8095/"
echo "  Runtime   : http://187.77.30.206:8081/health"
echo "  Settings  : http://187.77.30.206:8082/health"
echo "  Hermes    : http://187.77.30.206:8091/health"
echo "═══════════════════════════════════════════════════"
