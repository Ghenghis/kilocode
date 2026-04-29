#!/usr/bin/env bash
# ── Contract Kit V17 — Full Health Check ────────────────────────────────────
# Run on VPS: bash healthcheck.sh
# Prints OK / FAIL for every service endpoint

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

check() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^2 ]]; then
    echo -e "  ${GREEN}OK${NC}    [${code}] ${label} — ${url}"
  else
    echo -e "  ${RED}FAIL${NC}  [${code}] ${label} — ${url}"
  fi
}

echo "=== Contract Kit V17 Health Check ==="
echo ""

echo "── Infrastructure ──────────────────"
check "NATS monitor"       "http://localhost:8222/healthz"
check "PostgreSQL"         "http://localhost:8000/health"   # via runtime-core

echo ""
echo "── Core Services ───────────────────"
check "Runtime Core API"   "http://localhost:8000/health"
check "Hermes Gateway"     "http://localhost:8091/health"
check "Shiba Memory"       "http://localhost:18789/health"
check "LiteLLM Proxy"      "http://localhost:8001/health"

echo ""
echo "── Hermes Agents ───────────────────"
check "hermes1 (Planning)" "http://localhost:8081/health"
check "hermes2 (Creative)" "http://localhost:8082/health"
check "hermes3 (Architect)" "http://localhost:8083/health"
check "hermes4 (Bug Triage)" "http://localhost:8084/health"
check "hermes5 (Root Cause)" "http://localhost:8085/health"

echo ""
echo "── WebUI ───────────────────────────"
check "Contract Kit Hub"   "http://localhost:8095"
check "Open WebUI"         "http://localhost:3000"

echo ""
echo "── Docker containers ───────────────"
docker ps --format "  {{.Status}}\t{{.Names}}" | sort

echo ""
echo "── API smoke test ──────────────────"
echo -n "  Runtime /api/settings: "
curl -s http://localhost:8000/api/settings | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK —', len(d), 'keys')" 2>/dev/null || echo "FAIL"

echo ""
echo "=== Done ==="
