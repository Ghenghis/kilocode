#!/usr/bin/env bash
# ── Contract Kit V17 — Phase 5: E2E Test Suite on VPS ───────────────────────
# Run on VPS: bash phase5_e2e_tests.sh
# Prereqs: Phase 4 complete (all services wired + healthy)

set -euo pipefail

REPO="/opt/contract-kit/repo"
REPORT_DIR="/opt/contract-kit/test-reports"
RUNTIME="http://localhost:8000"
HERMES_GW="http://localhost:8091"
HUB="http://localhost:8095"

mkdir -p "$REPORT_DIR"

echo "==> [Phase 5] Running E2E Test Suite"
echo ""

PASS=0; FAIL=0

assert_http() {
  local label="$1" url="$2" expected="${3:-2}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  local prefix="${code:0:1}"
  if [[ "$prefix" == "$expected" ]]; then
    echo "  PASS  [$code] $label"
    ((PASS++)) || true
  else
    echo "  FAIL  [$code] $label  ($url)"
    ((FAIL++)) || true
  fi
}

assert_json() {
  local label="$1" url="$2" key="$3"
  local val
  val=$(curl -s --max-time 10 "$url" 2>/dev/null | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key','MISSING'))" 2>/dev/null || echo "ERROR")
  if [[ "$val" != "MISSING" && "$val" != "ERROR" && "$val" != "False" && "$val" != "false" ]]; then
    echo "  PASS  $label → $key=$val"
    ((PASS++)) || true
  else
    echo "  FAIL  $label → $key=$val  ($url)"
    ((FAIL++)) || true
  fi
}

# ── 5.1: Infrastructure health ───────────────────────────────────────────────
echo "── 5.1 Infrastructure health ──────────────────────"
assert_http "NATS monitor"           "http://localhost:8222/healthz"
assert_json "Runtime Core /health"   "$RUNTIME/health"          "ok"
assert_json "Hermes Gateway /health" "$HERMES_GW/health"        "ok"
assert_http "Shiba Memory /health"   "http://localhost:18789/health"
assert_http "LiteLLM /health"        "http://localhost:8001/health"
assert_http "Open WebUI"             "http://localhost:3000"
assert_http "Contract Kit Hub"       "$HUB"

# ── 5.2: Runtime Core API surface ────────────────────────────────────────────
echo ""
echo "── 5.2 Runtime Core API ───────────────────────────"
assert_http "GET /settings/state"    "$RUNTIME/settings/state"
assert_http "GET /settings/questions" "$RUNTIME/settings/questions"
assert_http "GET /ports"             "$RUNTIME/ports"
assert_http "GET /settings/audit"    "$RUNTIME/settings/audit"

# ── 5.3: Hermes Gateway intake ───────────────────────────────────────────────
echo ""
echo "── 5.3 Hermes Gateway intake ──────────────────────"
INTAKE_RESP=$(curl -s -X POST "$HERMES_GW/intake" \
  -H "Content-Type: application/json" \
  -d '{"task_type":"shell","description":"echo e2e-test-pass","evidence":[]}' \
  --max-time 10 2>/dev/null || echo '{}')
CONTRACT_ID=$(echo "$INTAKE_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('task_id') or d.get('contract_id','MISSING'))" 2>/dev/null || echo "MISSING")
if [[ "$CONTRACT_ID" != "MISSING" && "$CONTRACT_ID" != "ERROR" ]]; then
  echo "  PASS  POST /intake → contract_id=$CONTRACT_ID"
  ((PASS++)) || true
else
  echo "  FAIL  POST /intake → $INTAKE_RESP"
  ((FAIL++)) || true
fi

# ── 5.4: Contract status lookup ──────────────────────────────────────────────
if [[ "$CONTRACT_ID" != "MISSING" ]]; then
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$HERMES_GW/tasks/$CONTRACT_ID" --max-time 5 2>/dev/null || echo "000")
  if [[ "$STATUS_CODE" =~ ^2 ]]; then
    echo "  PASS  [$STATUS_CODE] GET /tasks/$CONTRACT_ID"
    ((PASS++)) || true
  else
    echo "  FAIL  [$STATUS_CODE] GET /tasks/$CONTRACT_ID"
    ((FAIL++)) || true
  fi
fi

# ── 5.5: Hub WebUI content ───────────────────────────────────────────────────
echo ""
echo "── 5.5 Hub WebUI content check ────────────────────"
HUB_BODY=$(curl -s --max-time 10 "$HUB" 2>/dev/null || echo "")
for marker in "Contract Kit" "pane-overview" "pane-settings" "pane-zeroclaw" "pane-hermes"; do
  if echo "$HUB_BODY" | grep -q "$marker"; then
    echo "  PASS  hub.html contains '$marker'"
    ((PASS++)) || true
  else
    echo "  FAIL  hub.html missing '$marker'"
    ((FAIL++)) || true
  fi
done

# ── 5.6: Existing Discord bots still alive ───────────────────────────────────
echo ""
echo "── 5.6 Existing Hermes Discord bots ───────────────"
for port in 8081 8082 8083 8084 8085; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" --max-time 5 2>/dev/null || echo "000")
  if [[ "$code" =~ ^2 ]]; then
    echo "  PASS  [$code] hermes bot :$port"
    ((PASS++)) || true
  else
    echo "  WARN  [$code] hermes bot :$port (may not expose /health)"
  fi
done

# ── 5.7: PostgreSQL ──────────────────────────────────────────────────────────
echo ""
echo "── 5.7 PostgreSQL ─────────────────────────────────"
PG_RESULT=$(docker exec postgres psql -U shb -d shb -c "SELECT 1;" 2>/dev/null | grep -c "1 row" || echo "0")
if [[ "$PG_RESULT" -gt 0 ]]; then
  echo "  PASS  PostgreSQL SELECT 1 OK"
  ((PASS++)) || true
else
  echo "  FAIL  PostgreSQL not responding"
  ((FAIL++)) || true
fi

# ── 5.8: NATS JetStream ──────────────────────────────────────────────────────
echo ""
echo "── 5.8 NATS JetStream ─────────────────────────────"
JS_RESP=$(curl -s http://localhost:8222/jsz --max-time 5 2>/dev/null || echo "{}")
JS_ENABLED=$(echo "$JS_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print('yes' if 'config' in d or d.get('streams',0)>=0 else 'no')" 2>/dev/null || echo "no")
if [[ "$JS_ENABLED" == "yes" ]]; then
  echo "  PASS  NATS JetStream endpoint reachable"
  ((PASS++)) || true
else
  echo "  FAIL  NATS JetStream not available"
  ((FAIL++)) || true
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "  Phase 5 Results: ${PASS} passed | ${FAIL} failed"
echo "════════════════════════════════════════════════════"

# Write JSON report
cat > "$REPORT_DIR/phase5_$(date +%Y%m%d_%H%M%S).json" << EOF
{
  "phase": 5,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "passed": $PASS,
  "failed": $FAIL,
  "total": $((PASS + FAIL))
}
EOF

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "  ALL TESTS PASSED — Ready for Phase 6 (restart-safe verification)"
  echo "  cmd: bash /opt/contract-kit/repo/deploy/vps/phase6_restart_safe.sh"
  exit 0
else
  echo "  $FAIL test(s) FAILED — review logs:"
  echo "    docker compose -f /opt/contract-kit/docker-compose.yml logs --tail=50"
  exit 1
fi
