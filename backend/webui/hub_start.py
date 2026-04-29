"""
Hub v2 — Launcher.

Starts the Hub on port 8095. All configuration is via environment variables.
See hub/config.py for the full list of supported env vars.

Usage:
  python hub_start.py
  HUB_ADMIN_TOKEN=mysecret python hub_start.py
  HUB_PORT=8095 python hub_start.py

MCP config for Claude / Cursor / Windsurf:
  { "mcpServers": { "hub": { "url": "http://localhost:8095/mcp" } } }

Open WebUI:
  Admin → Settings → Connections → MCP → http://localhost:8095/mcp
"""
import os
import sys

# Ensure src/webui is on the path so `hub` package resolves
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from hub import create_app

PORT = int(os.environ.get("HUB_PORT", "8095"))
HOST = os.environ.get("HUB_HOST", "0.0.0.0")
BASE_URL = os.environ.get("HUB_BASE_URL", f"http://localhost:{PORT}")

if __name__ == "__main__":
    token = os.environ.get("HUB_ADMIN_TOKEN", "")
    if not token:
        print("[hub] WARNING: HUB_ADMIN_TOKEN not set — running in dev mode (no auth enforcement)")
    else:
        print(f"[hub] Auth enabled — token configured ({len(token)} chars)")

    app = create_app(base_url=BASE_URL)
    print(f"[hub] Starting Hub v2 on http://{HOST}:{PORT}")
    print(f"[hub] MCP endpoint: {BASE_URL}/mcp")
    print(f"[hub] Events (SSE): {BASE_URL}/events")
    print(f"[hub] Panels manifest: {BASE_URL}/panels/manifest.json")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
