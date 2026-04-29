#!/bin/bash
# Install corrected systemd service files and start all 3 kilocode services
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[install]${RESET} $*"; }
success() { echo -e "${GREEN}[  OK  ]${RESET} $*"; }
fail()    { echo -e "${RED}[ FAIL ]${RESET} $*"; }

# ── kilocode-runtime.service (port 8081 — 8080 taken by open-webui container) ─
cat > /etc/systemd/system/kilocode-runtime.service <<'SVC'
[Unit]
Description=KiloCode Runtime API
After=network.target nats.service
Wants=nats.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/kilocode
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONPATH=/opt/kilocode
EnvironmentFile=-/opt/kilocode/.env
ExecStart=/opt/kilocode/venv/bin/uvicorn src.runtime.__main__:app \
    --host 0.0.0.0 --port 8081 --workers 1 --log-level info
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kilocode-runtime

[Install]
WantedBy=multi-user.target
SVC

# ── kilocode-hermes.service (port 8090) ──────────────────────────────────────
cat > /etc/systemd/system/kilocode-hermes.service <<'SVC'
[Unit]
Description=KiloCode Hermes Orchestrator
After=network.target nats.service kilocode-runtime.service
Wants=nats.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/kilocode
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONPATH=/opt/kilocode
EnvironmentFile=-/opt/kilocode/.env
ExecStart=/opt/kilocode/venv/bin/uvicorn src.hermes.__main__:app \
    --host 0.0.0.0 --port 8090 --workers 1 --log-level info
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kilocode-hermes

[Install]
WantedBy=multi-user.target
SVC

# ── kilocode-webui.service (port 8095 — 7860 taken by open-webui docker) ─────
cat > /etc/systemd/system/kilocode-webui.service <<'SVC'
[Unit]
Description=KiloCode Control Center WebUI
After=network.target kilocode-runtime.service
Wants=kilocode-runtime.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/kilocode
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONPATH=/opt/kilocode
EnvironmentFile=-/opt/kilocode/.env
ExecStart=/opt/kilocode/venv/bin/uvicorn src.webui.__main__:app \
    --host 0.0.0.0 --port 8095 --workers 1 --log-level info
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kilocode-webui

[Install]
WantedBy=multi-user.target
SVC

info "Reloading systemd..."
systemctl daemon-reload

info "Enabling services..."
systemctl enable kilocode-runtime kilocode-hermes kilocode-webui

info "Starting services..."
systemctl restart kilocode-runtime
sleep 3
systemctl restart kilocode-hermes
sleep 3
systemctl restart kilocode-webui
sleep 3

echo ""
echo "=== Service Status ==="
for svc in kilocode-runtime kilocode-hermes kilocode-webui; do
    STATUS=$(systemctl is-active $svc)
    if [[ "$STATUS" == "active" ]]; then
        success "$svc: $STATUS"
    else
        fail "$svc: $STATUS"
        journalctl -u $svc -n 10 --no-pager
    fi
done

echo ""
echo "=== Health Checks ==="
sleep 2
for port_svc in "8081:runtime" "8090:hermes" "8095:webui"; do
    PORT=${port_svc%%:*}
    SVC=${port_svc##*:}
    HTTP=$(curl -sf http://localhost:$PORT/health -o /dev/null -w '%{http_code}' 2>/dev/null || echo "no-response")
    BODY=$(curl -sf http://localhost:$PORT/health 2>/dev/null || echo "")
    if [[ "$HTTP" == "200" ]]; then
        success "$SVC :$PORT/health => $HTTP | $BODY"
    else
        fail "$SVC :$PORT/health => $HTTP"
    fi
done
