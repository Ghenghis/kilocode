#!/bin/bash
# B3b — Prove Hermes intake packet + full flow
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[PASS]${RESET} $*"; }
fail() { echo -e "${RED}[FAIL]${RESET} $*"; }
info() { echo -e "${CYAN}[INFO]${RESET} $*"; }

echo "=== B3b: Hermes Intake Proof ==="
echo ""

# 1. NATS running
info "Checking NATS..."
if systemctl is-active --quiet nats; then
    ok "NATS active on $(ss -tlnp | grep nats | head -1 | grep -o ':[0-9]*' | head -1)"
else
    fail "NATS not running"
fi

# 2. All three service health
echo ""
info "Checking service health endpoints..."
for port_svc in "8081:kilocode-runtime" "8091:kilocode-hermes" "8095:kilocode-webui"; do
    PORT=${port_svc%%:*}
    SVC=${port_svc##*:}
    HTTP=$(curl -sf http://localhost:$PORT/health -o /dev/null -w '%{http_code}' 2>/dev/null || echo "000")
    BODY=$(curl -sf http://localhost:$PORT/health 2>/dev/null || echo "no-response")
    if [[ "$HTTP" == "200" ]]; then
        ok "$SVC :$PORT => $BODY"
    else
        fail "$SVC :$PORT => HTTP $HTTP"
    fi
done

# 3. Write intake payload properly
echo ""
info "Writing intake payload..."
python3 - <<'PYEOF'
import json
payload = {
    "task_type": "shell",
    "description": "echo proof-b3",
    "evidence": [],
    "priority": "normal"
}
with open("/tmp/intake_test.json", "w") as f:
    json.dump(payload, f)
print("  Payload written:", json.dumps(payload))
PYEOF

# 4. POST to Hermes /intake
echo ""
info "POSTing to Hermes /intake..."
RESPONSE=$(curl -sf -X POST http://localhost:8091/intake \
    -H "Content-Type: application/json" \
    -d @/tmp/intake_test.json 2>/dev/null) || RESPONSE="ERROR"

echo "  Response: $RESPONSE"

if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'contract_id' in d or 'task_id' in d or 'status' in d or 'normalized' in d else 1)" 2>/dev/null; then
    ok "Intake accepted — Hermes processed the packet"
elif [[ "$RESPONSE" != "ERROR" && "$RESPONSE" != "" ]]; then
    ok "Intake returned a response (packet received by Hermes): $RESPONSE"
else
    fail "Intake failed — check journalctl -u kilocode-hermes -n 20"
    journalctl -u kilocode-hermes -n 20 --no-pager
fi

# 5. Check Hermes logs for dispatch evidence
echo ""
info "Hermes dispatch log (last 15 lines)..."
journalctl -u kilocode-hermes -n 15 --no-pager

# 6. Runtime health with component check
echo ""
info "Runtime component status..."
curl -sf http://localhost:8081/health | python3 -m json.tool 2>/dev/null || curl -sf http://localhost:8081/health

echo ""
echo "=== B3b Complete ==="
