#!/bin/bash
set -euo pipefail
NATS_VERSION=2.10.14
ARCH=$(uname -m)
case "$ARCH" in x86_64) NA=amd64;; aarch64) NA=arm64;; *) NA=amd64;; esac
NATS_TMP=$(mktemp -d)
echo "Downloading NATS ${NATS_VERSION} ${NA}..."
curl -sSL "https://github.com/nats-io/nats-server/releases/download/v${NATS_VERSION}/nats-server-v${NATS_VERSION}-linux-${NA}.tar.gz" -o "$NATS_TMP/nats.tar.gz"
tar -xzf "$NATS_TMP/nats.tar.gz" -C "$NATS_TMP"
install -m 0755 "$NATS_TMP/nats-server-v${NATS_VERSION}-linux-${NA}/nats-server" /usr/local/bin/nats-server
rm -rf "$NATS_TMP"
echo "NATS installed: $(nats-server --version)"

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
sleep 2
systemctl is-active nats && echo "NATS running: OK" || echo "NATS failed to start"
