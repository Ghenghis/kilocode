#!/bin/bash
# Deploy Open WebUI Pipelines service + wire it into Open WebUI
# https://github.com/open-webui/pipelines
set -euo pipefail

PIPELINES_PORT=9099
PIPELINES_URL="http://localhost:${PIPELINES_PORT}"
WEBUI_CONTAINER="open-webui"

echo "=== Open WebUI Pipelines Deploy ==="

# ── 0. Ensure shiba-postgres is running with restart=always ──────────────────
if docker inspect shiba-postgres &>/dev/null; then
  docker update --restart=always shiba-postgres
  docker start shiba-postgres 2>/dev/null || true
  echo "shiba-postgres: restart=always set"
fi

# ── 0b. Persist iptables rule for Shiba (port 18789) ────────────────────────
iptables -C INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4
echo "iptables: Shiba port 18789 rule persisted"

# ── 1. Pull latest pipelines image ──────────────────────────────────────────
echo "Pulling latest pipelines image..."
docker pull ghcr.io/open-webui/pipelines:main

# ── 2. Stop + remove old container if exists ────────────────────────────────
if docker inspect pipelines &>/dev/null; then
  echo "Stopping existing pipelines container..."
  docker stop pipelines 2>/dev/null || true
  docker rm   pipelines 2>/dev/null || true
fi

# ── 3. Create data directory ─────────────────────────────────────────────────
mkdir -p /opt/data/pipelines

# ── 4. Launch pipelines container ───────────────────────────────────────────
echo "Starting pipelines container on port ${PIPELINES_PORT}..."
docker run -d \
  --name pipelines \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  --ulimit nofile=65536:65536 \
  -p ${PIPELINES_PORT}:9099 \
  -v /opt/data/pipelines:/app/pipelines \
  -e PIPELINES_DIR=/app/pipelines \
  -e PIPELINES_API_KEY=0p3n-w3bu! \
  ghcr.io/open-webui/pipelines:main

echo "Waiting 15s for pipelines to start..."
sleep 15

# ── 5. Verify pipelines is up ───────────────────────────────────────────────
PIPE_STATUS=$(docker inspect pipelines --format '{{.State.Status}}' 2>/dev/null || echo "missing")
PIPE_HTTP=$(curl -sf ${PIPELINES_URL}/ -o /dev/null -w '%{http_code}' 2>/dev/null || echo "no-response")
echo "Pipelines container : ${PIPE_STATUS}"
echo "Pipelines HTTP      : ${PIPE_HTTP} at :${PIPELINES_PORT}"

# ── 6. Restart Open WebUI with OPENAI_API_BASE_URL pointing to pipelines ────
# This is how Open WebUI detects pipelines — it must see the pipelines URL
# as one of its OpenAI-compatible base URLs.
echo ""
echo "Rewiring Open WebUI to use Pipelines..."
docker stop ${WEBUI_CONTAINER} 2>/dev/null || true
docker rm   ${WEBUI_CONTAINER} 2>/dev/null || true

docker run -d \
  --name ${WEBUI_CONTAINER} \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  --ulimit nofile=65536:65536 \
  -p 7860:8080 \
  -v open-webui:/app/backend/data \
  -e SCARF_NO_ANALYTICS=true \
  -e DO_NOT_TRACK=true \
  -e ANONYMIZED_TELEMETRY=false \
  -e WHISPER_MODEL=base \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -e OPENAI_API_BASE_URL=http://host.docker.internal:${PIPELINES_PORT} \
  -e WEBUI_URL=https://hermes.daveai.tech \
  -e RAG_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2 \
  -e AUXILIARY_EMBEDDING_MODEL=TaylorAI/bge-micro-v2 \
  -e SENTENCE_TRANSFORMERS_HOME=/app/backend/data/cache/embedding/models \
  -e HF_HOME=/app/backend/data/cache/embedding/models \
  ghcr.io/open-webui/open-webui:main

echo "Waiting 25s for Open WebUI to start..."
sleep 25

# ── 7. Final health check ────────────────────────────────────────────────────
WEB_STATUS=$(docker inspect ${WEBUI_CONTAINER} --format '{{.State.Status}}' 2>/dev/null)
WEB_HTTP=$(curl -sf http://localhost:7860/ -o /dev/null -w '%{http_code}' 2>/dev/null || echo "no-response")

echo ""
echo "=== FINAL STATUS ==="
echo "Pipelines : ${PIPE_STATUS} / HTTP ${PIPE_HTTP} at :${PIPELINES_PORT}"
echo "Open WebUI: ${WEB_STATUS} / HTTP ${WEB_HTTP} at :7860"
echo ""

if [[ "${PIPE_STATUS}" == "running" && "${WEB_STATUS}" == "running" && "${WEB_HTTP}" == "200" ]]; then
  echo "=== DEPLOY COMPLETE ==="
  echo "Visit https://hermes.daveai.tech/admin/settings/pipelines"
  echo "Pipelines should now show as DETECTED."
else
  echo "=== CHECK NEEDED ==="
  echo "  docker logs pipelines --tail 30"
  echo "  docker logs open-webui --tail 30"
fi
