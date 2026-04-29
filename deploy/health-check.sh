#!/usr/bin/env bash
# =============================================================================
# KiloCode MAOS — Remote Health Check
# Usage: bash deploy/health-check.sh
# SSHs into the VPS and verifies every expected container + HTTP endpoint.
# Exit 0 = all healthy, Exit 1 = one or more failures.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Load local .env if present ────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

VPS_HOST="${VPS_HOST:-187.77.30.206}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="/opt/kilocode"

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

echo "=== KiloCode MAOS — Remote Health Check ==="
echo "    Target: $VPS_USER@$VPS_HOST"
echo ""

# ── Run all checks on the remote host ────────────────────────────────────────
# shellcheck disable=SC2086
RESULT=$(ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash -s <<'REMOTE_EOF'
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FAILURES=0

# ── Helper: check an HTTP endpoint ───────────────────────────────────────────
check_http() {
  local label="$1"
  local url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^(2|3) ]]; then
    echo -e "  ${GREEN}[OK ]${NC}  $label  ($url)  HTTP $code"
  else
    echo -e "  ${RED}[FAIL]${NC} $label  ($url)  HTTP $code"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── Helper: check a container is running ─────────────────────────────────────
check_container() {
  local name="$1"
  local state
  state=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  if [[ "$state" == "running" ]]; then
    echo -e "  \033[0;32m[OK ]\033[0m  container $name  (running)"
  else
    echo -e "  \033[0;31m[FAIL]\033[0m container $name  ($state)"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── Container status ──────────────────────────────────────────────────────────
echo "── Containers ──────────────────────────────────────"
for c in postgres nats shiba runtime-core hermes-gateway \
          hermes1 hermes2 hermes3 hermes4 hermes5 \
          litellm open-webui hub; do
  check_container "$c"
done

echo ""
echo "── Service HTTP endpoints ───────────────────────────"
check_http "runtime-core  :8000/health"   "http://localhost:8000/health"
check_http "hermes-gateway:8091/health"   "http://localhost:8091/health"
check_http "hermes1       :8081/health"   "http://localhost:8081/health"
check_http "hermes2       :8082/health"   "http://localhost:8082/health"
check_http "hermes3       :8083/health"   "http://localhost:8083/health"
check_http "hermes4       :8084/health"   "http://localhost:8084/health"
check_http "hermes5       :8085/health"   "http://localhost:8085/health"
check_http "shiba-memory  :18789/health"  "http://localhost:18789/health"
check_http "litellm       :8001/health"   "http://localhost:8001/health"
check_http "hub-webui     :8095"          "http://localhost:8095"
check_http "open-webui    :3000"          "http://localhost:3000"
check_http "nats-monitor  :8222/healthz"  "http://localhost:8222/healthz"

echo ""
echo "── docker compose ps ───────────────────────────────"
docker compose -f /opt/kilocode/docker-compose.production.yml ps 2>/dev/null || \
  docker ps --format "  {{.Status}}\t{{.Names}}" | sort

echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo -e "\033[0;32mAll checks passed.\033[0m  FAILURES=0"
  exit 0
else
  echo -e "\033[0;31m$FAILURES check(s) FAILED.\033[0m"
  exit 1
fi
REMOTE_EOF
)

EXIT_CODE=$?
echo "$RESULT"

echo ""
if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "=== Overall: HEALTHY (exit 0) ==="
else
  echo "=== Overall: DEGRADED (exit 1) — see FAIL lines above ==="
fi

exit "$EXIT_CODE"
