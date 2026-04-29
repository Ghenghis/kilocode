#!/usr/bin/env bash
# ── Contract Kit V17 — Phase 7: Final Acceptance Checklist ──────────────────
# Run on VPS: bash phase7_acceptance.sh

set -euo pipefail

PASS=0; FAIL=0; WARN=0

ok()   { echo "  ✅  $1"; ((PASS++)) || true; }
fail() { echo "  ❌  $1"; ((FAIL++)) || true; }
warn() { echo "  ⚠️   $1"; ((WARN++)) || true; }

http_ok() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url" 2>/dev/null || echo "000")
  [[ "$code" =~ ^2 ]]
}

echo "==> [Phase 7] Final Acceptance Verification"
echo "    VPS: 187.77.30.206  |  $(date -u)"
echo ""

# ── 7.1: Infrastructure ──────────────────────────────────────────────────────
echo "── 7.1 Infrastructure ─────────────────────────────"
docker info &>/dev/null                  && ok  "Docker running" || fail "Docker not running"
docker compose version &>/dev/null       && ok  "Docker Compose available" || fail "Docker Compose missing"
df -h / | awk 'NR==2{if($5+0<90) exit 0; exit 1}' && ok "Disk usage <90%" || warn "Disk usage high"
free -m | awk '/Mem/{if($3/$2<0.95) exit 0; exit 1}' && ok "Memory usage <95%" || warn "Memory usage high"

# ── 7.2: Service health ───────────────────────────────────────────────────────
echo ""
echo "── 7.2 Service health ──────────────────────────────"
http_ok "http://localhost:8000/health"   && ok  "Runtime Core API (:8000)" || fail "Runtime Core API (:8000)"
http_ok "http://localhost:8091/health"   && ok  "Hermes Gateway (:8091)"   || fail "Hermes Gateway (:8091)"
http_ok "http://localhost:18789/health"  && ok  "Shiba Memory (:18789)"    || fail "Shiba Memory (:18789)"
http_ok "http://localhost:8222/healthz"  && ok  "NATS (:8222)"             || fail "NATS (:8222)"
http_ok "http://localhost:8001/health"   && ok  "LiteLLM (:8001)"          || warn "LiteLLM (:8001) - optional"
http_ok "http://localhost:3000"          && ok  "Open WebUI (:3000)"        || warn "Open WebUI (:3000) - optional"
http_ok "http://localhost:8095"          && ok  "Contract Kit Hub (:8095)"  || fail "Contract Kit Hub (:8095)"

# ── 7.3: Hermes Discord bots ─────────────────────────────────────────────────
echo ""
echo "── 7.3 Hermes Discord bots ─────────────────────────"
for port in 8081 8082 8083 8084 8085; do
  STATUS=$(docker ps --filter "publish=$port" --format "{{.Status}}" 2>/dev/null | head -1)
  if [[ "$STATUS" == *"Up"* ]]; then
    ok "hermes bot :$port — $STATUS"
  else
    warn "hermes bot :$port — not detected (may use different port mapping)"
  fi
done

# ── 7.4: Integration checks ───────────────────────────────────────────────────
echo ""
echo "── 7.4 Integration ─────────────────────────────────"

# Settings API returns data
SETTINGS=$(curl -s http://localhost:8000/settings/state --max-time 8 2>/dev/null || echo "{}")
KEYS=$(echo "$SETTINGS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
[[ "$KEYS" -gt 0 ]] && ok "Settings API returns $KEYS keys" || fail "Settings API returned no data"

# Hermes intake creates a contract
INTAKE=$(curl -s -X POST http://localhost:8091/intake \
  -H "Content-Type: application/json" \
  -d '{"task_type":"shell","description":"acceptance-test","evidence":[]}' \
  --max-time 10 2>/dev/null || echo "{}")
TID=$(echo "$INTAKE" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('task_id') or d.get('contract_id',''))" 2>/dev/null || echo "")
[[ -n "$TID" ]] && ok "Hermes intake created contract: $TID" || fail "Hermes intake failed: $INTAKE"

# PostgreSQL responsive
PG=$(docker exec postgres psql -U shb -d shb -t -c "SELECT 'ok';" 2>/dev/null | tr -d ' \n' || echo "")
[[ "$PG" == "ok" ]] && ok "PostgreSQL query OK" || fail "PostgreSQL not responding"

# ── 7.5: Systemd / persistence ───────────────────────────────────────────────
echo ""
echo "── 7.5 Boot persistence ────────────────────────────"
systemctl is-enabled contract-kit-stack &>/dev/null \
  && ok  "contract-kit-stack.service enabled on boot" \
  || warn "contract-kit-stack.service NOT enabled (run: systemctl enable contract-kit-stack)"
iptables -C INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT 2>/dev/null \
  && ok  "iptables Shiba rule active" \
  || warn "iptables Shiba rule missing"

# ── Final summary ─────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL + WARN))
echo "  Phase 7 Final Acceptance: ${PASS}✅  ${FAIL}❌  ${WARN}⚠️  (${TOTAL} checks)"
echo "════════════════════════════════════════════════════════"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo "  🎉  CONTRACT KIT V17 — DEPLOYMENT ACCEPTED"
  echo ""
  echo "  Public endpoints:"
  echo "    Control Hub:    http://187.77.30.206:8095"
  echo "    Runtime API:    http://187.77.30.206:8000"
  echo "    Hermes Gateway: http://187.77.30.206:8091"
  echo "    Open WebUI:     http://187.77.30.206:3000"
  echo "    NATS Monitor:   http://187.77.30.206:8222"
  echo ""
  [[ $WARN -gt 0 ]] && echo "  ⚠️  $WARN warning(s) — non-critical, see above"
  exit 0
else
  echo "  ❌  $FAIL critical check(s) failed — deployment NOT accepted"
  echo "  Fix failures then re-run: bash phase7_acceptance.sh"
  exit 1
fi
