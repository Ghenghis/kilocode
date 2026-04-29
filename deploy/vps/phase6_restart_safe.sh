#!/usr/bin/env bash
# ── Contract Kit V17 — Phase 6: Restart-Safe Verification ───────────────────
# Run on VPS: bash phase6_restart_safe.sh
# Prereqs: Phase 5 passed

set -euo pipefail

COMPOSE="/opt/contract-kit"
PASS=0; FAIL=0

check_health() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^2 ]]; then
    echo "  OK  [$code] $label"
    ((PASS++)) || true
  else
    echo "  FAIL [$code] $label"
    ((FAIL++)) || true
  fi
}

echo "==> [Phase 6] Restart-Safe Verification"
echo ""

# ── 6.1: Individual service restart tests ────────────────────────────────────
echo "── 6.1 Individual container restart tests ─────────"
for svc in runtime-core hermes-gateway postgres nats; do
  echo -n "  Restarting $svc..."
  docker compose -f "$COMPOSE/docker-compose.yml" restart "$svc" 2>/dev/null
  sleep 8
  echo " done"
done
sleep 10

check_health "runtime-core after restart"   "http://localhost:8000/health"
check_health "hermes-gateway after restart" "http://localhost:8091/health"
check_health "NATS after restart"           "http://localhost:8222/healthz"

# ── 6.2: PostgreSQL data persistence ─────────────────────────────────────────
echo ""
echo "── 6.2 PostgreSQL data persistence ────────────────"
# Write a test record, restart postgres, verify it survives
docker exec postgres psql -U shb -d shb -c \
  "CREATE TABLE IF NOT EXISTS ck_restart_test (ts timestamptz DEFAULT now()); INSERT INTO ck_restart_test DEFAULT VALUES;" \
  2>/dev/null && echo "  Test record written"

docker compose -f "$COMPOSE/docker-compose.yml" restart postgres 2>/dev/null
sleep 12

ROW_COUNT=$(docker exec postgres psql -U shb -d shb -t -c \
  "SELECT COUNT(*) FROM ck_restart_test;" 2>/dev/null | tr -d ' \n' || echo "0")
if [[ "$ROW_COUNT" -gt 0 ]]; then
  echo "  PASS  PostgreSQL data survived restart ($ROW_COUNT row(s))"
  ((PASS++)) || true
else
  echo "  FAIL  PostgreSQL data lost after restart"
  ((FAIL++)) || true
fi

# ── 6.3: Full stack down → up ────────────────────────────────────────────────
echo ""
echo "── 6.3 Full stack down/up cycle ───────────────────"
echo "  Stopping all contract-kit services..."
docker compose -f "$COMPOSE/docker-compose.yml" down --timeout 20 2>/dev/null
sleep 5

echo "  Starting all services..."
docker compose -f "$COMPOSE/docker-compose.yml" up -d 2>/dev/null
echo "  Waiting 40s for full startup..."
sleep 40

check_health "Runtime Core (post full restart)"   "http://localhost:8000/health"
check_health "Hermes Gateway (post full restart)"  "http://localhost:8091/health"
check_health "Shiba Memory (post full restart)"    "http://localhost:18789/health"
check_health "NATS (post full restart)"            "http://localhost:8222/healthz"
check_health "Hub WebUI (post full restart)"       "http://localhost:8095"
check_health "Open WebUI (post full restart)"      "http://localhost:3000"

# ── 6.4: Systemd auto-start verification ─────────────────────────────────────
echo ""
echo "── 6.4 Systemd unit enabled ────────────────────────"
if systemctl is-enabled contract-kit-stack &>/dev/null; then
  echo "  PASS  contract-kit-stack.service is enabled"
  ((PASS++)) || true
else
  echo "  WARN  contract-kit-stack.service not enabled — enabling now..."
  systemctl enable contract-kit-stack 2>/dev/null || true
fi

# ── 6.5: iptables persistence ────────────────────────────────────────────────
echo ""
echo "── 6.5 iptables Shiba rule ─────────────────────────"
if iptables -C INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT 2>/dev/null; then
  echo "  PASS  iptables Shiba rule active"
  ((PASS++)) || true
else
  echo "  WARN  iptables rule missing — re-adding..."
  iptables -I INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT
  iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
  iptables-save > /etc/iptables.rules 2>/dev/null || true
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "  Phase 6 Results: ${PASS} passed | ${FAIL} failed"
echo "════════════════════════════════════════════════════"
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "  ALL CHECKS PASSED — System is restart-safe!"
  echo "  Ready for Phase 7 (Final Acceptance)"
  echo ""
  echo "  Final acceptance checklist:"
  echo "    bash /opt/contract-kit/repo/deploy/vps/phase7_acceptance.sh"
else
  echo "  $FAIL check(s) FAILED — review with:"
  echo "    docker compose -f /opt/contract-kit/docker-compose.yml ps"
  echo "    docker compose -f /opt/contract-kit/docker-compose.yml logs --tail=30"
  exit 1
fi
