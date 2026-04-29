#!/usr/bin/env bash
# ── Contract Kit V17 — Phase 3: Build images on VPS + start stack ───────────
# Run on VPS: bash build_and_push.sh
# Must run AFTER deploy.sh has cloned the repo to /opt/contract-kit/repo

set -euo pipefail

REPO="/opt/contract-kit/repo"
DEPLOY_DIR="$REPO/deploy"
SRC_DIR="$REPO/src"

echo "==> [Phase 3] Building Contract Kit Docker images on VPS"
echo ""

# ── Step 3.1: Pull latest repo changes ───────────────────────────────────────
echo "==> [3.1] Pulling latest from integration/main..."
git -C "$REPO" pull origin integration/main

# ── Step 3.2: Build runtime-core ─────────────────────────────────────────────
echo ""
echo "==> [3.2] Building runtime-core image..."
cp "$DEPLOY_DIR/docker/runtime-core/requirements-runtime.txt" "$REPO/"
docker build \
  -f "$DEPLOY_DIR/docker/runtime-core/Dockerfile" \
  -t contract-kit/runtime-core:latest \
  "$REPO"
echo "  runtime-core built ✓"

# ── Step 3.3: Build hermes-gateway ───────────────────────────────────────────
echo ""
echo "==> [3.3] Building hermes-gateway image..."
cp "$DEPLOY_DIR/docker/hermes-gateway/requirements-hermes.txt" "$REPO/"
docker build \
  -f "$DEPLOY_DIR/docker/hermes-gateway/Dockerfile" \
  -t contract-kit/hermes-gateway:latest \
  "$REPO"
echo "  hermes-gateway built ✓"

# ── Step 3.4: Start (or restart) the full stack ───────────────────────────────
echo ""
echo "==> [3.4] Starting full stack with docker compose..."
cd /opt/contract-kit

# Restart only newly-built services; leave existing hermes bots untouched
docker compose up -d --no-deps runtime-core hermes-gateway postgres nats litellm open-webui hub shiba

echo ""
echo "==> [3.5] Waiting 30s for services to be healthy..."
sleep 30

# ── Step 3.5: Health check ───────────────────────────────────────────────────
echo ""
echo "==> [3.5] Health checks:"
PASS=0; FAIL=0
check_svc() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^2 ]]; then
    echo "  OK    [$code] $label"
    ((PASS++)) || true
  else
    echo "  FAIL  [$code] $label  ($url)"
    ((FAIL++)) || true
  fi
}

check_svc "Runtime Core API"    "http://localhost:8000/health"
check_svc "Hermes Gateway"      "http://localhost:8091/health"
check_svc "NATS monitor"        "http://localhost:8222/healthz"
check_svc "Shiba Memory"        "http://localhost:18789/health"
check_svc "LiteLLM Proxy"       "http://localhost:8001/health"
check_svc "Open WebUI"          "http://localhost:3000"
check_svc "Contract Kit Hub"    "http://localhost:8095"

# Existing hermes bots (already running)
check_svc "hermes1 (Discord)"   "http://localhost:8081/health" || true
check_svc "hermes2 (Discord)"   "http://localhost:8082/health" || true
check_svc "hermes3 (Discord)"   "http://localhost:8083/health" || true
check_svc "hermes4 (Discord)"   "http://localhost:8084/health" || true
check_svc "hermes5 (Discord)"   "http://localhost:8085/health" || true

echo ""
echo "==> Results: ${PASS} passed, ${FAIL} failed"
echo ""
echo "==> Phase 3 complete!"
echo ""
echo "    Control Hub:      http://187.77.30.206:8095"
echo "    Runtime API:      http://187.77.30.206:8000"
echo "    Hermes Gateway:   http://187.77.30.206:8091"
echo "    Open WebUI:       http://187.77.30.206:3000"
echo "    NATS Monitor:     http://187.77.30.206:8222"
echo ""
if [[ $FAIL -gt 0 ]]; then
  echo "  !! $FAIL service(s) not healthy — check: docker compose logs"
  exit 1
fi
