#!/usr/bin/env bash
# =============================================================================
# KiloCode MAOS — VPS Deployment Script
# Usage: bash deploy/deploy-vps.sh
# Prereqs: ssh, scp available locally; Docker + Docker Compose v2 on the VPS
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Load local .env if present ────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  # Export only the deployment-control vars we need; do not leak secrets to stdout
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

# ── Config (can be overridden by env or CLI export) ───────────────────────────
VPS_HOST="${VPS_HOST:-187.77.30.206}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR="/opt/kilocode"
COMPOSE_FILE="$SCRIPT_DIR/vps/docker-compose.production.yml"

# ── Validate prerequisites ────────────────────────────────────────────────────
echo "[pre-flight] Checking required files..."

if [[ ! -f "$SSH_KEY" ]]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  echo "       Set SSH_KEY=<path> or add it to deploy/.env"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: deploy/.env not found. Copy deploy/.env.example and populate it."
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: $COMPOSE_FILE not found."
  exit 1
fi

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

echo "[pre-flight] Connecting to $VPS_USER@$VPS_HOST ..."
# shellcheck disable=SC2086
ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_DIR"

# ── Step 1: SCP the .env file to VPS ─────────────────────────────────────────
echo ""
echo "[1/4] Uploading deploy/.env → $REMOTE_DIR/.env"
# shellcheck disable=SC2086
scp $SSH_OPTS "$ENV_FILE" "$VPS_USER@$VPS_HOST:$REMOTE_DIR/.env"
# Restrict permissions so only root can read secrets
# shellcheck disable=SC2086
ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" "chmod 600 $REMOTE_DIR/.env"
echo "      .env uploaded and permissions set to 600"

# ── Step 2: SCP the docker-compose file to VPS ───────────────────────────────
echo ""
echo "[2/4] Uploading docker-compose.production.yml → $REMOTE_DIR/"
# shellcheck disable=SC2086
scp $SSH_OPTS "$COMPOSE_FILE" "$VPS_USER@$VPS_HOST:$REMOTE_DIR/docker-compose.production.yml"
echo "      docker-compose.production.yml uploaded"

# ── Step 3: SSH in and start / update the stack ──────────────────────────────
echo ""
echo "[3/4] Pulling images and starting stack on $VPS_HOST ..."
# shellcheck disable=SC2086
ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash -s <<'REMOTE_EOF'
  set -euo pipefail
  cd /opt/kilocode

  # Source .env so docker compose can read vars (compose also does this natively
  # via env_file, but we set it explicitly for safety)
  if [[ -f .env ]]; then
    set -a; source .env; set +a
  fi

  echo "   docker compose pull ..."
  docker compose -f docker-compose.production.yml pull --quiet

  echo "   docker compose up -d ..."
  docker compose -f docker-compose.production.yml up -d --pull always --remove-orphans

  echo "   Stack started."
REMOTE_EOF

# ── Step 4: Wait then verify container health ─────────────────────────────────
echo ""
echo "[4/4] Waiting 10 seconds for containers to initialise..."
sleep 10

echo ""
echo "=== Container status on $VPS_HOST ==="
# shellcheck disable=SC2086
ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" \
  "docker compose -f $REMOTE_DIR/docker-compose.production.yml ps"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Deployment summary ==="
echo "  VPS:              $VPS_USER@$VPS_HOST"
echo "  Remote dir:       $REMOTE_DIR"
echo "  Compose file:     docker-compose.production.yml"
echo ""
echo "  Service endpoints (after nginx / port-forward):"
echo "    Runtime Core:   http://$VPS_HOST:8000/health"
echo "    Hermes Gateway: http://$VPS_HOST:8091/health"
echo "    hermes1:        http://$VPS_HOST:8081/health"
echo "    hermes2:        http://$VPS_HOST:8082/health"
echo "    hermes3:        http://$VPS_HOST:8083/health"
echo "    hermes4:        http://$VPS_HOST:8084/health"
echo "    hermes5:        http://$VPS_HOST:8085/health"
echo "    Hub WebUI:      http://$VPS_HOST:8095"
echo "    Open WebUI:     http://$VPS_HOST:3000"
echo "    NATS Monitor:   http://$VPS_HOST:8222"
echo "    Shiba Memory:   http://$VPS_HOST:18789/health"
echo ""
echo "  Run deploy/health-check.sh to verify all endpoints."
echo "=== Done ==="
