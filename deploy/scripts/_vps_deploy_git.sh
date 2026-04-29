#!/usr/bin/env bash
# _vps_deploy_git.sh
# Deploy KiloCode Control Hub to VPS via GitHub pull
#
# Usage (from Windows Git Bash / WSL):
#   bash deploy/scripts/_vps_deploy_git.sh
#
# Or run remotely:
#   ssh root@187.77.30.206 'bash /opt/kilocode/deploy/scripts/_vps_deploy_git.sh'

set -euo pipefail
VPS="root@187.77.30.206"
DEPLOY_DIR="/opt/kilocode"
REPO_URL="https://github.com/Ghenghis/contract-kit-v17.git"
BRANCH="integration/main"

echo "═══════════════════════════════════════════════════"
echo " KiloCode Control Hub — Git Deploy"
echo " Target : $VPS"
echo " Repo   : $REPO_URL  [$BRANCH]"
echo " Dir    : $DEPLOY_DIR"
echo "═══════════════════════════════════════════════════"

ssh "$VPS" bash << REMOTE
set -euo pipefail
DEPLOY_DIR="$DEPLOY_DIR"
REPO_URL="$REPO_URL"
BRANCH="$BRANCH"

echo "[1/6] Clone or pull repo..."
if [ -d "\$DEPLOY_DIR/.git" ]; then
  cd "\$DEPLOY_DIR"
  git fetch origin
  git checkout "\$BRANCH"
  git reset --hard "origin/\$BRANCH"
  echo "  git pull done"
else
  git clone --branch "\$BRANCH" "\$REPO_URL" "\$DEPLOY_DIR"
  echo "  git clone done"
fi

echo "[2/6] Ensure directories..."
mkdir -p "\$DEPLOY_DIR/data" "\$DEPLOY_DIR/logs"

echo "[3/6] Create venv + install deps..."
if [ ! -f "\$DEPLOY_DIR/venv/bin/python" ]; then
  python3 -m venv "\$DEPLOY_DIR/venv"
fi
"\$DEPLOY_DIR/venv/bin/pip" install -q --upgrade pip
"\$DEPLOY_DIR/venv/bin/pip" install -q fastapi uvicorn httpx pydantic
if [ -f "\$DEPLOY_DIR/requirements.txt" ]; then
  "\$DEPLOY_DIR/venv/bin/pip" install -q -r "\$DEPLOY_DIR/requirements.txt"
fi
echo "  deps OK"

echo "[4/6] Install systemd units..."
for f in "\$DEPLOY_DIR"/deploy/systemd/*.service; do
  svcname=\$(basename "\$f")
  cp "\$f" "/etc/systemd/system/\$svcname"
  echo "  installed \$svcname"
done

echo "[5/6] Open firewall ports..."
for port in 8081 8082 8091 8095; do
  ufw allow \$port/tcp 2>/dev/null && echo "  ufw: \$port allowed" || \
  iptables -I INPUT -p tcp --dport \$port -j ACCEPT 2>/dev/null && echo "  iptables: \$port allowed" || \
  echo "  port \$port: no ufw/iptables (ok if internal)"
done

echo "[6a/6] Reload systemd + start services..."
systemctl daemon-reload

for svc in kilocode-runtime kilocode-settings kilocode-hermes kilocode-webui; do
  systemctl enable "\$svc" 2>/dev/null || true
  systemctl restart "\$svc" && echo "  started: \$svc" || echo "  WARNING: \$svc failed"
done

echo "[6b/6] Health checks (up to 30s each)..."
health_check() {
  local name="\$1" url="\$2" n=0
  until curl -sf "\$url" -o /dev/null 2>/dev/null; do
    n=\$((n+1))
    [ \$n -ge 15 ] && { echo "  FAIL: \$name not at \$url"; return 1; }
    sleep 2
  done
  echo "  OK  : \$name  (\$url)"
}

health_check kilocode-runtime  http://localhost:8081/health
health_check kilocode-settings http://localhost:8082/health
health_check kilocode-webui    http://localhost:8095/health
# hermes may need NATS — soft check
health_check kilocode-hermes   http://localhost:8091/health || echo "  (hermes may need NATS — check separately)"

echo ""
echo "═══════════════════════════════════════════════════"
echo " DEPLOY COMPLETE"
echo "  Dashboard : http://187.77.30.206:8095/"
echo "  Runtime   : http://187.77.30.206:8081/health"
echo "  Settings  : http://187.77.30.206:8082/health"
echo "═══════════════════════════════════════════════════"
REMOTE
