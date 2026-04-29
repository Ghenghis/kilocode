#!/usr/bin/env bash
# ── Contract Kit V17 — VPS Deploy Script ────────────────────────────────────
# Run on VPS: bash deploy.sh
# Prereqs: Docker, Docker Compose v2, git installed on VPS

set -euo pipefail

VPS_IP="187.77.30.206"
DEPLOY_DIR="/opt/contract-kit"
REPO_URL="https://github.com/Ghenghis/contract-kit-v17.git"
BRANCH="integration/main"

echo "==> [1/7] Creating deploy directory structure"
mkdir -p "$DEPLOY_DIR"/{config,webui,webui-data}
mkdir -p /opt/litellm

echo "==> [2/7] Cloning/updating repo"
if [ -d "$DEPLOY_DIR/repo/.git" ]; then
  git -C "$DEPLOY_DIR/repo" pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$DEPLOY_DIR/repo"
fi

echo "==> [3/7] Copying WebUI (hub.html)"
cp "$DEPLOY_DIR/repo/src/webui/hub.html" "$DEPLOY_DIR/webui/hub.html"
cp "$DEPLOY_DIR/repo/deploy/vps/nginx-hub.conf" "$DEPLOY_DIR/nginx-hub.conf"

echo "==> [4/7] Copying docker-compose and env"
cp "$DEPLOY_DIR/repo/deploy/vps/docker-compose.production.yml" "$DEPLOY_DIR/docker-compose.yml"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cp "$DEPLOY_DIR/repo/deploy/vps/.env.production" "$DEPLOY_DIR/.env"
  echo "  >> IMPORTANT: Edit $DEPLOY_DIR/.env with real API keys before starting!"
fi

echo "==> [5/7] Copying nginx config"
cp "$DEPLOY_DIR/repo/deploy/vps/nginx.conf" /etc/nginx/sites-available/contract-kit.conf
ln -sf /etc/nginx/sites-available/contract-kit.conf /etc/nginx/sites-enabled/contract-kit.conf
nginx -t && systemctl reload nginx

echo "==> [6/7] Writing LiteLLM config"
cat > /opt/litellm/config.yaml << 'LITELLM_EOF'
model_list:
  - model_name: minimax
    litellm_params:
      model: openai/MiniMax-Text-01
      api_base: https://api.minimax.chat/v1
      api_key: os.environ/MINIMAX_API_KEY
  - model_name: siliconflow
    litellm_params:
      model: openai/Qwen/Qwen2.5-72B-Instruct
      api_base: https://api.siliconflow.cn/v1
      api_key: os.environ/SILICONFLOW_API_KEY
general_settings:
  master_key: ${LITELLM_MASTER_KEY}
LITELLM_EOF

echo "==> [7/7] Starting all services"
cd "$DEPLOY_DIR"
docker compose pull --quiet
docker compose up -d

echo ""
echo "==> Waiting 30s for services to start..."
sleep 30

echo ""
echo "==> Health checks:"
for svc in "8000/health" "8091/health" "8081/health" "8082/health" "8083/health" "8084/health" "8085/health" "18789/health"; do
  port="${svc%%/*}"
  path="/${svc##*/}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}" 2>/dev/null || echo "FAIL")
  echo "  :${port}${path} → ${status}"
done

echo ""
echo "==> Deploy complete!"
echo "    Hub WebUI:      http://${VPS_IP}:8095"
echo "    Open WebUI:     http://${VPS_IP}:3000"
echo "    Runtime API:    http://${VPS_IP}:8000"
echo "    Hermes Gateway: http://${VPS_IP}:8091"
echo "    NATS Monitor:   http://${VPS_IP}:8222"
