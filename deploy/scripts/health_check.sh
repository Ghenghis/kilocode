#!/bin/bash
# =============================================================================
# health_check.sh — Verify all KiloCode services are running
# Usage: bash deploy/scripts/health_check.sh [--remote]
#
# Flags:
#   --remote   SSH to VPS (187.77.30.206) and run checks there
# =============================================================================

set -euo pipefail

VPS_HOST="${VPS_HOST:-187.77.30.206}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE=false

for arg in "$@"; do
  case $arg in
    --remote) REMOTE=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Colour & table helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0; FAIL=0; WARN=0

pass() { echo -e "  ${GREEN}[PASS]${RESET} $*"; ((PASS++)) || true; }
fail() { echo -e "  ${RED}[FAIL]${RESET} $*"; ((FAIL++)) || true; }
warn() { echo -e "  ${YELLOW}[WARN]${RESET} $*"; ((WARN++)) || true; }

# ---------------------------------------------------------------------------
# If --remote, tunnel the whole script to VPS
# ---------------------------------------------------------------------------
if $REMOTE; then
  echo -e "${CYAN}Running health checks on ${VPS_HOST}...${RESET}"
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no \
    "${VPS_USER}@${VPS_HOST}" \
    "bash -s" < "$0"
  exit $?
fi

# ---------------------------------------------------------------------------
# Check: systemd service active
# ---------------------------------------------------------------------------
check_service() {
  local name=$1
  if command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet "$name" 2>/dev/null; then
      pass "systemd service: $name"
    else
      local status
      status=$(systemctl is-active "$name" 2>/dev/null || echo "unknown")
      fail "systemd service: $name  (status=$status)"
    fi
  else
    warn "systemctl not available — skipping service check for $name"
  fi
}

# ---------------------------------------------------------------------------
# Check: HTTP endpoint
# ---------------------------------------------------------------------------
check_http() {
  local label=$1 url=$2
  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time 5 "$url" 2>/dev/null || echo "000")
  if [[ "$http_code" == "2"* ]]; then
    pass "HTTP ${http_code}: $label  ($url)"
  elif [[ "$http_code" == "000" ]]; then
    fail "HTTP TIMEOUT/REFUSED: $label  ($url)"
  else
    warn "HTTP ${http_code}: $label  ($url)  — non-2xx"
  fi
}

# ---------------------------------------------------------------------------
# Check: port is listening
# ---------------------------------------------------------------------------
check_port() {
  local label=$1 port=$2
  if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
     netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
    pass "Port listening: $label (:$port)"
  else
    fail "Port not listening: $label (:$port)"
  fi
}

# ===========================================================================
# Run checks
# ===========================================================================

echo ""
echo -e "${BOLD}${CYAN}============================================${RESET}"
echo -e "${BOLD}${CYAN}  KiloCode Health Check — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo -e "${BOLD}${CYAN}============================================${RESET}"

# --- Systemd services -------------------------------------------------------
echo ""
echo -e "${BOLD}Systemd Services${RESET}"
check_service kilocode-runtime
check_service kilocode-hermes
check_service kilocode-webui
check_service nginx
check_service nats   # optional — may not be running as systemd svc

# --- Ports ------------------------------------------------------------------
echo ""
echo -e "${BOLD}Port Bindings${RESET}"
check_port "Runtime API"    8080
check_port "Hermes"         8090
check_port "WebUI"          7860
check_port "NATS"           4222
check_port "Nginx HTTP"     80
check_port "Nginx HTTPS"    443

# --- HTTP endpoints ---------------------------------------------------------
echo ""
echo -e "${BOLD}HTTP Health Endpoints${RESET}"
check_http "Runtime /health"   "http://localhost:8080/health"
check_http "Hermes  /health"   "http://localhost:8090/health"
check_http "WebUI   /"         "http://localhost:7860/"
check_http "Nginx   /"         "http://localhost/"

# --- Disk & memory (warnings only) -----------------------------------------
echo ""
echo -e "${BOLD}Resource Checks${RESET}"

DISK_PCT=$(df /opt/kilocode 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo 0)
if [[ "$DISK_PCT" -ge 90 ]]; then
  fail "Disk usage at ${DISK_PCT}% for /opt/kilocode"
elif [[ "$DISK_PCT" -ge 75 ]]; then
  warn "Disk usage at ${DISK_PCT}% for /opt/kilocode"
else
  pass "Disk usage at ${DISK_PCT}% for /opt/kilocode"
fi

MEM_AVAIL=$(awk '/MemAvailable/{printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null || echo 9999)
if [[ "$MEM_AVAIL" -lt 256 ]]; then
  fail "Low available RAM: ${MEM_AVAIL} MB"
elif [[ "$MEM_AVAIL" -lt 512 ]]; then
  warn "Available RAM: ${MEM_AVAIL} MB"
else
  pass "Available RAM: ${MEM_AVAIL} MB"
fi

# ---------------------------------------------------------------------------
# Summary table
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}============================================${RESET}"
printf "  ${GREEN}PASS: %-3d${RESET}  ${YELLOW}WARN: %-3d${RESET}  ${RED}FAIL: %-3d${RESET}\n" \
  "$PASS" "$WARN" "$FAIL"
echo -e "${BOLD}${CYAN}============================================${RESET}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "\n${RED}Deployment has failures — investigate above.${RESET}"
  echo "  journalctl -u kilocode-runtime -n 50"
  echo "  journalctl -u kilocode-hermes  -n 50"
  echo "  journalctl -u kilocode-webui   -n 50"
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "\n${YELLOW}Deployment running with warnings.${RESET}"
  exit 0
else
  echo -e "\n${GREEN}All checks passed — deployment healthy.${RESET}"
  exit 0
fi
