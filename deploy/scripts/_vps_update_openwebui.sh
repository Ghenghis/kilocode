#!/bin/bash
# Safe Open WebUI update — data volume + all env vars preserved
set -euo pipefail

echo "=== Open WebUI Update ==="
echo "Current:"
docker inspect open-webui --format '  image={{.Config.Image}}  status={{.State.Status}}' 2>/dev/null

echo ""
echo "Pulling latest image..."
docker pull ghcr.io/open-webui/open-webui:main

echo ""
echo "Stopping old container (data volume preserved)..."
docker stop open-webui
docker rm open-webui

echo "Starting updated container with preserved config..."
docker run -d \
  --name open-webui \
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
  -e OPENAI_API_BASE_URL=http://host.docker.internal:9099 \
  -e WEBUI_URL=https://hermes.daveai.tech \
  -e RAG_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2 \
  -e AUXILIARY_EMBEDDING_MODEL=TaylorAI/bge-micro-v2 \
  -e SENTENCE_TRANSFORMERS_HOME=/app/backend/data/cache/embedding/models \
  -e HF_HOME=/app/backend/data/cache/embedding/models \
  ghcr.io/open-webui/open-webui:main

echo ""
echo "Waiting 20s for startup..."
sleep 20

STATUS=$(docker inspect open-webui --format '{{.State.Status}}')
HTTP=$(curl -sf http://localhost:7860/ -o /dev/null -w '%{http_code}' 2>/dev/null || echo "no-response")
IMAGE=$(docker inspect open-webui --format '{{.Config.Image}}')
BUILD=$(docker inspect open-webui --format '{{range .Config.Env}}{{if (hasPrefix . "WEBUI_BUILD_VERSION=")}}{{.}}{{end}}{{end}}' 2>/dev/null || echo "")

echo "Status  : $STATUS"
echo "HTTP    : $HTTP at :7860"
echo "Image   : $IMAGE"
echo "Build   : $BUILD"

if [[ "$STATUS" == "running" && "$HTTP" == "200" ]]; then
  echo ""
  echo "=== UPDATE COMPLETE AND HEALTHY ==="
else
  echo ""
  echo "=== CHECK NEEDED — run: docker logs open-webui --tail 40 ==="
fi
