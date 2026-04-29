# Contract Kit v17 + Hermes + KiloCode — Windsurf Quickstart

## 30-SECOND SUMMARY
- **Project:** Contract Kit v17 + Hermes + KiloCode
- **Status:** 100% implementation complete, deployment needed
- **Location:** `G:\Github\contract-kit-v17`

## PRE-REQUISITES
- SSH access to `187.77.30.206`
- Docker + Docker Compose installed
- Python 3.10+
- Node.js 18+

## 5-MINUTE DEPLOYMENT

**Step 1: SSH to VPS**
```bash
ssh root@187.77.30.206
```

**Step 2: Clone/Pull Hermes**
```bash
cd /opt/hermes
git pull
```

**Step 3: Start NATS**
```bash
docker run -d -p 4222:4222 nats:latest -js
```

**Step 4: Deploy Hermes agents**
```bash
cd /opt/hermes
docker-compose up -d
```

**Step 5: Verify**
```bash
curl http://localhost:8000/health
```

## KEY FILES
- **Handoff Pack:** `WINDSURF_EXECUTION_HANDOFF_PACK.md`
- **Service Map:** See Part 4 of handoff pack
- **Tests:** `tests/e2e/*.py`

## TROUBLESHOOTING
- **NATS not working:** `docker logs <container>`
- **Hermes failing:** `journalctl -u hermes1 -f`
- **WebUI down:** `sudo systemctl status nginx`
