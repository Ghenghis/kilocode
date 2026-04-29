#!/usr/bin/env bash
# ── Contract Kit V17 — Phase 4: Wire services + configure providers ──────────
# Run on VPS: bash phase4_wire_services.sh
# Prereqs: Phase 3 complete (all containers healthy)

set -euo pipefail

ENV_FILE="/opt/contract-kit/.env"
RUNTIME="http://localhost:8000"

echo "==> [Phase 4] Wiring services together"
echo ""

# ── 4.1: Ensure iptables rule for Shiba Memory (port 18789) is persistent ────
echo "==> [4.1] Making iptables rule for Shiba Memory persistent..."
iptables -C INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT
# Persist with iptables-save if available
if command -v iptables-save &>/dev/null; then
  iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
  iptables-save > /etc/iptables.rules 2>/dev/null || true
fi
echo "  Shiba iptables rule active ✓"

# ── 4.2: Reload nginx with contract-kit config ────────────────────────────────
echo ""
echo "==> [4.2] Reloading nginx..."
nginx -t && systemctl reload nginx
echo "  nginx reloaded ✓"

# ── 4.3: Push provider API keys to Runtime Core ───────────────────────────────
echo ""
echo "==> [4.3] Configuring provider API keys via Runtime API..."

source "$ENV_FILE" 2>/dev/null || true

if [[ -n "${MINIMAX_API_KEY:-}" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "$RUNTIME/api/settings/providers.minimax.api_key" \
    -H "Content-Type: application/json" \
    -d "\"$MINIMAX_API_KEY\"" 2>/dev/null || echo "000")
  echo "  MiniMax API key: [$code]"
else
  echo "  MiniMax API key: SKIPPED (not set in .env)"
fi

if [[ -n "${SILICONFLOW_API_KEY:-}" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "$RUNTIME/api/settings/providers.siliconflow.api_key" \
    -H "Content-Type: application/json" \
    -d "\"$SILICONFLOW_API_KEY\"" 2>/dev/null || echo "000")
  echo "  SiliconFlow API key: [$code]"
else
  echo "  SiliconFlow API key: SKIPPED (not set in .env)"
fi

# ── 4.4: NATS subject verification ───────────────────────────────────────────
echo ""
echo "==> [4.4] Verifying NATS JetStream..."
if command -v nats &>/dev/null; then
  nats server report 2>/dev/null | head -5 || true
  echo "  NATS stream list:"
  nats stream ls 2>/dev/null || echo "  (no streams yet — will be created on first use)"
else
  echo "  nats CLI not installed — checking via HTTP monitor:"
  curl -s http://localhost:8222/jsz | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print('  streams:', d.get('streams',0))" 2>/dev/null || \
    echo "  JetStream not enabled (add -js flag to NATS container)"
fi

# ── 4.5: Smoke test full round-trip ──────────────────────────────────────────
echo ""
echo "==> [4.5] Smoke test: POST /intake → Hermes Gateway..."
RESP=$(curl -s -X POST http://localhost:8091/intake \
  -H "Content-Type: application/json" \
  -d '{"task_type":"shell","description":"echo smoke-test","evidence":[]}' \
  2>/dev/null || echo '{"error":"network"}')
echo "  Response: $RESP" | head -c 200
echo ""

# ── 4.6: Settings state verification ─────────────────────────────────────────
echo ""
echo "==> [4.6] Verifying Runtime settings API..."
curl -s "$RUNTIME/settings/state" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('  Settings keys:', len(d))" 2>/dev/null || \
  echo "  /settings/state not responding yet"

echo ""
echo "==> Phase 4 complete!"
echo ""
echo "  Next: Phase 5 — Run E2E tests"
echo "  cmd:  cd /opt/contract-kit/repo && bash deploy/vps/phase5_e2e_tests.sh"
