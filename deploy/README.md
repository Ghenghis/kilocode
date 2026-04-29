# KiloCode contract-kit-v17 — Deployment Guide

## Overview

This package deploys the KiloCode stack to a VPS at **187.77.30.206** (daveai.tech).

| Service | Port | Purpose |
|---------|------|---------|
| Runtime API | 8080 | FastAPI core — providers, event bus, health |
| Hermes | 8090 | Orchestrator — task fanout, contracts |
| WebUI | 7860 | Control center (Open WebUI convention) |
| NATS | 4222 | Internal message bus |
| Nginx HTTP | 80 | Public proxy (redirects to HTTPS) |
| Nginx HTTPS | 443 | SSL-terminated public proxy |
| LiteLLM | 4000 | Internal LLM proxy (100.117.190.97) |

Public routes (via Nginx):
- `/` → WebUI (port 7860)
- `/api/` → Runtime API (port 8080)
- `/hermes/` → Hermes (port 8090)

---

## Prerequisites

**Local machine:**
- SSH key at `~/.ssh/id_ed25519` with access to `187.77.30.206`
- `scp` and `ssh` available
- `rsync` (optional, but recommended for incremental deploys)

**VPS (first time only):**
- Ubuntu 20.04 / 22.04 LTS
- Root or sudo access

---

## Quick Deploy (one command)

```bash
# 1. Copy and fill in environment variables
cp deploy/.env.example deploy/.env
$EDITOR deploy/.env

# 2. Run the full deployment
bash deploy/deploy.sh
```

That's it. The script will:
1. SSH to the VPS and create `/opt/kilocode/`
2. Upload source packages
3. Install Python dependencies in a venv
4. Install systemd service files
5. Install and test the Nginx config
6. Enable + start all services
7. Run a health check and print a status table

---

## Manual Steps

### Step 0 — Bootstrap VPS (first time)

SSH into the VPS and run the dependency installer:

```bash
# On your local machine
ssh root@187.77.30.206

# On the VPS
bash /tmp/install_deps.sh   # upload via scp first
```

Or run it directly:

```bash
scp -i ~/.ssh/id_ed25519 deploy/scripts/install_deps.sh root@187.77.30.206:/tmp/
ssh -i ~/.ssh/id_ed25519 root@187.77.30.206 "bash /tmp/install_deps.sh"
```

### Step 1 — Configure environment

```bash
cp deploy/.env.example deploy/.env
# Edit deploy/.env with your actual API keys and settings
```

### Step 2 — Deploy

```bash
bash deploy/deploy.sh
```

### Step 3 — Enable SSL (Let's Encrypt)

After DNS for `daveai.tech` points to `187.77.30.206`:

```bash
ssh root@187.77.30.206
certbot --nginx -d daveai.tech -d www.daveai.tech
```

Certbot will automatically edit the Nginx config to add SSL. Then uncomment the
HTTPS server block in `/etc/nginx/sites-available/kilocode.conf`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KILOCODE_API_KEY` | Yes | Internal API authentication key |
| `KILOCODE_RUNTIME_URL` | Yes | URL of the Runtime API |
| `KILOCODE_MODEL` | Yes | Default LLM model (e.g. `gpt-4`) |
| `KILOCODE_PROVIDER` | Yes | LLM provider (`openai`, `anthropic`, etc.) |
| `NATS_URL` | Yes | NATS connection string |
| `WEBUI_AGENT_TOKEN` | Yes | Token for WebUI agent authentication |
| `OPEN_WEBUI_PORT` | No | WebUI port (default: 7860) |
| `OPENAI_API_KEY` | Recommended | OpenAI API key |
| `ANTHROPIC_API_KEY` | Recommended | Anthropic API key |
| `LITELLM_BASE_URL` | No | LiteLLM proxy URL (default: http://100.117.190.97:4000) |
| `VPS_HOST` | Deploy only | VPS IP/hostname |
| `VPS_USER` | Deploy only | SSH user (default: root) |
| `SSH_KEY` | Deploy only | Path to SSH private key |

---

## Docker Compose (local dev)

```bash
# Build and start everything
docker compose -f deploy/docker-compose.yml up --build

# Background
docker compose -f deploy/docker-compose.yml up -d

# Logs
docker compose -f deploy/docker-compose.yml logs -f

# Tear down
docker compose -f deploy/docker-compose.yml down
```

Services will be available at:
- Runtime: http://localhost:8080
- Hermes:  http://localhost:8090
- WebUI:   http://localhost:7860
- NATS:    nats://localhost:4222

---

## Health Check

```bash
# Check services on VPS remotely
bash deploy/scripts/health_check.sh --remote

# Check services locally (run on VPS)
bash deploy/scripts/health_check.sh
```

---

## Troubleshooting

### Service won't start

```bash
# View last 50 log lines for a service
journalctl -u kilocode-runtime -n 50
journalctl -u kilocode-hermes  -n 50
journalctl -u kilocode-webui   -n 50

# Watch live
journalctl -u kilocode-runtime -f
```

### Port already in use

```bash
ss -tlnp | grep '8080\|8090\|7860'
# Kill the conflicting process or change the port in the service file
```

### Python import errors

Check that `PYTHONPATH=/opt/kilocode` is set and imports use `src.` prefix:

```python
from src.runtime.core import RuntimeCoreAPI
from src.hermes.orchestrator import HermesOrchestrator
from src.zeroclaw.adapters import ZeroClawGateway
```

### Nginx 502 Bad Gateway

The upstream service is not running or listening on the expected port. Check:

```bash
systemctl status kilocode-runtime
curl -v http://localhost:8080/health
nginx -t
```

### NATS connection refused

```bash
systemctl status nats
curl http://localhost:8222/healthz
```

---

## File Layout

```
deploy/
├── deploy.sh                  # Main deployment script (run this)
├── docker-compose.yml         # Docker Compose for local dev / VPS
├── .env.example               # Environment variable template
├── README.md                  # This file
├── packages/                  # tar.gz build artifacts (populated by CI)
├── nginx/
│   ├── kilocode.conf          # Nginx server block
│   └── kilocode-proxy.inc     # Shared proxy location blocks
├── scripts/
│   ├── health_check.sh        # Service health verification
│   └── install_deps.sh        # VPS bootstrap (Python, Nginx, NATS)
└── systemd/
    ├── kilocode-runtime.service
    ├── kilocode-hermes.service
    └── kilocode-webui.service
```
