#!/usr/bin/env bash
# _vps_oneliner.sh
# Paste this ENTIRE block into your VPS SSH session (root@187.77.30.206)
# No local ssh access needed — runs fully on the VPS side.
#
# Usage on VPS:
#   curl -sL https://raw.githubusercontent.com/Ghenghis/contract-kit-v17/integration/main/deploy/scripts/_vps_oneliner.sh | bash
# Or paste block directly.

set -euo pipefail
DEPLOY_DIR="/opt/kilocode"
REPO_URL="https://github.com/Ghenghis/contract-kit-v17.git"
BRANCH="integration/main"

echo "=== [1/6] Git clone / pull ==="
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd "$DEPLOY_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  echo "  pulled"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  echo "  cloned"
fi
cd "$DEPLOY_DIR"

echo "=== [2/6] Directories ==="
mkdir -p "$DEPLOY_DIR/data" "$DEPLOY_DIR/logs"

echo "=== [3/6] Python venv + deps ==="
if [ ! -f "$DEPLOY_DIR/venv/bin/python" ]; then
  python3 -m venv "$DEPLOY_DIR/venv"
fi
"$DEPLOY_DIR/venv/bin/pip" install -q --upgrade pip
"$DEPLOY_DIR/venv/bin/pip" install -q fastapi uvicorn httpx pydantic
[ -f "$DEPLOY_DIR/requirements.txt" ] && "$DEPLOY_DIR/venv/bin/pip" install -q -r "$DEPLOY_DIR/requirements.txt" || true
echo "  deps OK"

echo "=== [4/6] Systemd units ==="
for f in "$DEPLOY_DIR"/deploy/systemd/*.service; do
  cp "$f" /etc/systemd/system/
  echo "  installed $(basename $f)"
done
systemctl daemon-reload

echo "=== [5/6] Firewall ports 8081 8082 8091 8095 ==="
for port in 8081 8082 8091 8095; do
  ufw allow $port/tcp 2>/dev/null && echo "  ufw: $port" || \
  iptables -I INPUT -p tcp --dport $port -j ACCEPT 2>/dev/null && echo "  iptables: $port" || \
  echo "  $port: no change needed"
done

echo "=== [6/6] Enable + restart services ==="
for svc in kilocode-runtime kilocode-settings kilocode-webui; do
  systemctl enable "$svc" 2>/dev/null || true
  systemctl restart "$svc" && echo "  started: $svc" || journalctl -u "$svc" -n 20 --no-pager
done
# hermes optional (needs NATS)
systemctl enable kilocode-hermes 2>/dev/null || true
systemctl restart kilocode-hermes && echo "  started: kilocode-hermes" || echo "  WARNING: hermes may need NATS - check: journalctl -u kilocode-hermes -n 30"

echo ""
echo "=== Health checks ==="
sleep 5
for svc_url in "runtime|http://localhost:8081/health" "settings|http://localhost:8082/health" "webui|http://localhost:8095/health"; do
  name="${svc_url%%|*}"; url="${svc_url##*|}"
  if curl -sf "$url" -o /dev/null 2>/dev/null; then
    echo "  OK  : $name  ($url)"
  else
    echo "  FAIL: $name  ($url)"
    systemctl status "kilocode-$name" --no-pager -n 10 || true
  fi
done

echo ""
echo "======================================="
echo " DEPLOY COMPLETE"
echo "  Hub      : http://187.77.30.206:8095/"
echo "  Runtime  : http://187.77.30.206:8081/health"
echo "  Settings : http://187.77.30.206:8082/health"
echo "======================================="
