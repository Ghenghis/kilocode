#!/bin/bash
# B4 — Boot/restart safety proof for all 3 kilocode services
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[PASS]${RESET} $*"; }
fail() { echo -e "${RED}[FAIL]${RESET} $*"; }
info() { echo -e "${CYAN}[INFO]${RESET} $*"; }

PASS=0; FAIL=0

check_health() {
    local name=$1 port=$2
    local HTTP=$(curl -sf http://localhost:$port/health -o /dev/null -w '%{http_code}' 2>/dev/null || echo "000")
    local BODY=$(curl -sf http://localhost:$port/health 2>/dev/null || echo "no-response")
    if [[ "$HTTP" == "200" ]]; then
        ok "$name :$port/health => $HTTP | $BODY"; ((PASS++)) || true
    else
        fail "$name :$port/health => $HTTP"; ((FAIL++)) || true
    fi
}

echo "=== B4: Restart Safety Proof ==="

# Restart each service and verify recovery
for svc_port in "kilocode-runtime:8081" "kilocode-hermes:8091" "kilocode-webui:8095"; do
    SVC=${svc_port%%:*}
    PORT=${svc_port##*:}
    echo ""
    info "Restarting $SVC..."
    systemctl restart $SVC
    sleep 5
    ACTIVE=$(systemctl is-active $SVC || echo "failed")
    if [[ "$ACTIVE" == "active" ]]; then
        ok "$SVC systemd: active after restart"
        ((PASS++)) || true
    else
        fail "$SVC systemd: $ACTIVE after restart"
        ((FAIL++)) || true
        journalctl -u $SVC -n 10 --no-pager
    fi
    check_health $SVC $PORT
done

# Verify NATS survives restart
echo ""
info "Restarting NATS..."
systemctl restart nats
sleep 3
NATS_ACTIVE=$(systemctl is-active nats || echo "failed")
if [[ "$NATS_ACTIVE" == "active" ]]; then
    ok "NATS: active after restart on port 4222"; ((PASS++)) || true
else
    fail "NATS: $NATS_ACTIVE after restart"; ((FAIL++)) || true
fi

# Verify iptables rule persisted
echo ""
info "Verifying iptables persistence (port 18789)..."
if iptables -L INPUT -n 2>/dev/null | grep -q "18789"; then
    ok "iptables 18789 rule: present"; ((PASS++)) || true
else
    fail "iptables 18789 rule: MISSING — re-apply"; ((FAIL++)) || true
fi

if [[ -f /etc/iptables/rules.v4 ]] && grep -q "18789" /etc/iptables/rules.v4; then
    ok "iptables rules.v4: persisted to disk"; ((PASS++)) || true
else
    fail "iptables rules.v4: not persisted"; ((FAIL++)) || true
fi

# Final health sweep
echo ""
info "Final health sweep after all restarts..."
sleep 2
check_health "kilocode-runtime" 8081
check_health "kilocode-hermes"  8091
check_health "kilocode-webui"   8095

echo ""
echo "=== B4 Summary: ${PASS} passed, ${FAIL} failed ==="
[[ $FAIL -eq 0 ]] && echo "B4: PASS" || echo "B4: NEEDS ATTENTION"
