#!/bin/bash
# Fix: Register Pipelines URL in Open WebUI via API + iptables
set -euo pipefail

WEBUI="http://localhost:7860"
PIPE_URL="http://172.17.0.1:9099"
PIPE_KEY="0p3n-w3bu!"

echo "=== Step 1: Allow Docker containers to reach host port 9099 ==="
iptables -I INPUT -s 172.0.0.0/8 -p tcp --dport 9099 -j ACCEPT
echo "iptables rule added."

echo ""
echo "=== Step 2: Verify pipelines reachable from inside open-webui container ==="
PIPE_CHECK=$(docker exec open-webui curl -sf http://172.17.0.1:9099/ 2>/dev/null | head -c 100 || echo "FAILED")
echo "Pipelines probe: $PIPE_CHECK"

if [[ "$PIPE_CHECK" == "FAILED" ]]; then
  echo "ERROR: open-webui still cannot reach pipelines. Check docker network."
  exit 1
fi

echo ""
echo "=== Step 3: Get Open WebUI admin token ==="
# Use the default admin credentials — adjust if changed
ADMIN_EMAIL="${WEBUI_ADMIN_EMAIL:-daveai@daveai.tech}"
ADMIN_PASS="${WEBUI_ADMIN_PASS:-}"

if [[ -z "$ADMIN_PASS" ]]; then
  echo "No WEBUI_ADMIN_PASS env set."
  echo "Run: WEBUI_ADMIN_PASS='yourpassword' bash $0"
  echo ""
  echo "=== Manual fallback: do this in the browser ==="
  echo "1. Go to https://hermes.daveai.tech/admin/settings/connections"
  echo "2. Under OpenAI API, click the + button"
  echo "3. URL: http://172.17.0.1:9099"
  echo "4. Key: 0p3n-w3bu!"
  echo "5. Click the refresh/verify icon → should go green"
  echo "6. Click Save"
  echo "7. Go to Settings > Pipelines — should now show Detected"
  exit 0
fi

TOKEN=$(curl -sf -X POST "$WEBUI/api/v1/auths/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

if [[ -z "$TOKEN" ]]; then
  echo "Could not get token. Wrong password?"
  echo ""
  echo "=== Manual fallback: do this in the browser ==="
  echo "1. Go to https://hermes.daveai.tech/admin/settings/connections"
  echo "2. Under OpenAI API, click the + button"
  echo "3. URL: http://172.17.0.1:9099"
  echo "4. Key: 0p3n-w3bu!"
  echo "5. Click the refresh/verify icon → should go green"
  echo "6. Click Save"
  exit 0
fi

echo "Token obtained."

echo ""
echo "=== Step 4: Register Pipelines as OpenAI connection ==="
RESULT=$(curl -sf -X POST "$WEBUI/api/v1/configs/openai/url" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$PIPE_URL\",\"key\":\"$PIPE_KEY\"}" 2>/dev/null || echo "API_NOT_FOUND")

echo "Result: $RESULT"

echo ""
echo "=== Step 5: Verify ==="
curl -sf "$WEBUI/api/v1/pipelines" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('Pipelines:', json.dumps(d, indent=2))" || echo "Could not query pipelines endpoint"

echo ""
echo "=== DONE ==="
echo "Now visit: https://hermes.daveai.tech/admin/settings/pipelines"
