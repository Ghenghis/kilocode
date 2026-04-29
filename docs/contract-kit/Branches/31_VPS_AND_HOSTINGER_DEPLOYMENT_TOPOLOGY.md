# 31 — VPS and Hostinger Deployment Topology

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

This document is the operational map of how DaveAI services reach the public internet. It pins the canonical hostnames, the upstream container/port wiring on the Hostinger VPS, the reverse-proxy templates, the TLS lifecycle, the backup-before-deploy contract, and the rollback path. Any change to production topology MUST be made through this document and the deployment cadence specified in §7 — never by editing files on the VPS directly without first capturing a rollback path.

---

## 1. Topology overview

Live website domain: `daveai.tech`. DNS provider: Cloudflare. Cloudflare nameservers: `kip.ns.cloudflare.com`, `ximena.ns.cloudflare.com`. VPS host: Hostinger, Ubuntu 24.04 Docker host, public IPv4 `187.77.30.206`. TLS termination: at the reverse proxy on the VPS (Caddy auto OR Nginx + certbot — exactly ONE of the two; first-contact discovery determines which).

| Subdomain | Purpose | Upstream container | Container port | Host bind |
|---|---|---|---|---|
| `daveai.tech` (apex) | Marketing landing | `daveai-www` | 8080 | 127.0.0.1:8080 |
| `www.daveai.tech` | Apex alias | `daveai-www` | 8080 | 127.0.0.1:8080 |
| `hermes.daveai.tech` | Hermes website | `hermes-web` | 3000 | 127.0.0.1:3000 |
| `hermes3d.daveai.tech` | Hermes 3D explorer | `hermes3d-web` | 3001 | 127.0.0.1:3001 |
| `fleet.daveai.tech` | Fleet console | `fleet-web` | 3002 | 127.0.0.1:3002 |
| `diy.daveai.tech` | DIY portal | `diy-web` | 3003 | 127.0.0.1:3003 |
| `game.daveai.tech` | Game sandbox | `game-web` | 3004 | 127.0.0.1:3004 |
| `openhands.daveai.tech` | OpenHands runtime | `openhands` | 3005 | 127.0.0.1:3005 |
| `voice.daveai.tech` | Voice service | `voice-web` | 3006 | 127.0.0.1:3006 |
| `hub.daveai.tech` | Contract-Kit Hub backend (FastAPI) | `hub-backend` | 8000 | 127.0.0.1:8000 |

All upstreams bind to `127.0.0.1` only. The reverse proxy is the only process listening on `0.0.0.0:80` and `0.0.0.0:443`. Cloudflare proxies (orange cloud) all subdomains; origin TLS is required regardless.

The VSIX auto-update endpoint published by the Hub is `https://hub.daveai.tech/api/updates/manifest` (channel via `?channel=stable|canary|dev`). Referenced by `AutoUpdateService.ts` per doc 23.

---

## 2. VPS access protocol

- **Key-based SSH only.** `PasswordAuthentication no` in `/etc/ssh/sshd_config`. Any password prompt is a discovery finding to remediate before any deploy.
- The operator's SSH private key is held in `ssh-agent` (`ssh-add ~/.ssh/id_ed25519_daveai`) and is **never** copied, exported, pasted into chat, pasted into a ticket, or stored in a repo.
- The VPS `~/.ssh/authorized_keys` is the source of truth for who can log in; SHA256 recorded in evidence after every change.
- All SSH sessions for production work are logged: `script -a /root/daveai-session-logs/$(date -u +%Y%m%d-%H%M%S).log` at session start.
- Hostinger's web-terminal fallback is reserved for the case where SSH is unreachable — never used as the primary access path because it bypasses the audit-log requirement.

```bash
ssh-add -l                                        # confirm agent loaded
ssh root@187.77.30.206 -o IdentitiesOnly=yes      # primary
# or, with ~/.ssh/config alias:
ssh daveai-vps
```

If the agent is empty: `ssh-add ~/.ssh/id_ed25519_daveai`. Never paste private key contents. Never `cat ~/.ssh/id_ed25519_daveai` in a session that may be screen-shared.

---

## 3. Container topology on the VPS

All services run under Docker, orchestrated by `/opt/daveai/docker-compose.yml`. Per-service environment files at `/opt/daveai/env/<service>.env` mode `0600`, owner `root:root`. Image tags pinned to release tags from doc 23; floating tags (`latest`) forbidden.

| Compose service | Container | Image | Internal port | Source repo |
|---|---|---|---|---|
| `hub-backend` | `hub-backend` | `ghcr.io/ghenghis/contract-kit-v17:vX.Y.Z` | 8000 | `contract-kit-v17` |
| `hermes-orchestrator` | `hermes-orchestrator` | `ghcr.io/ghenghis/hermes-agent-fresh:vX.Y.Z` | 4000 | `hermes-agent-fresh` |
| `hermes-web` | `hermes-web` | `ghcr.io/ghenghis/hermes.daveai.tech:vX.Y.Z` | 3000 | `hermes.daveai.tech` |
| `zeroclaw-runtime` | `zeroclaw-runtime` | `ghcr.io/ghenghis/zeroclaw:vX.Y.Z` (post-promotion per doc 30) | 5000 | `upgrade/zeroclaw` |
| `openhands` | `openhands` | `ghcr.io/all-hands-ai/openhands:vX.Y.Z` | 3005 | upstream |
| `daveai-www` | `daveai-www` | `ghcr.io/ghenghis/daveai-www:vX.Y.Z` | 8080 | landing repo |

Container-to-container traffic uses bridge network `daveai-net`. Cross-service URLs use service name, e.g. Hermes orchestrator reaches Hub at `http://hub-backend:8000`.

---

## 4. Reverse-proxy config templates

### 4a. Caddy variant — `/etc/caddy/Caddyfile`

```caddy
{
    email ops@daveai.tech
    admin off
}

(common) {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}

daveai.tech, www.daveai.tech {
    import common
    reverse_proxy 127.0.0.1:8080
}

hub.daveai.tech       { import common; reverse_proxy 127.0.0.1:8000 }
hermes.daveai.tech    { import common; reverse_proxy 127.0.0.1:3000 }
hermes3d.daveai.tech  { import common; reverse_proxy 127.0.0.1:3001 }
fleet.daveai.tech     { import common; reverse_proxy 127.0.0.1:3002 }
diy.daveai.tech       { import common; reverse_proxy 127.0.0.1:3003 }
game.daveai.tech      { import common; reverse_proxy 127.0.0.1:3004 }
openhands.daveai.tech { import common; reverse_proxy 127.0.0.1:3005 }
voice.daveai.tech     { import common; reverse_proxy 127.0.0.1:3006 }
```

Reload:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 4b. Nginx variant — `/etc/nginx/sites-available/daveai.tech.conf`

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name daveai.tech www.daveai.tech hub.daveai.tech
                hermes.daveai.tech hermes3d.daveai.tech fleet.daveai.tech
                diy.daveai.tech game.daveai.tech openhands.daveai.tech
                voice.daveai.tech;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hub.daveai.tech;

    ssl_certificate     /etc/letsencrypt/live/hub.daveai.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hub.daveai.tech/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_read_timeout 60s;
    }
}
# Replicate the 443 server block per subdomain.
```

Reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. TLS / certificate renewal

Caddy: automatic. `sudo caddy list-certificates`; tail `journalctl -u caddy -f`. No cron required.

Nginx: certbot via `certbot.timer`:
```bash
systemctl list-timers certbot.timer
sudo certbot renew --dry-run
```

Cadence: certbot runs twice daily; LE issues 90-day certs, renewed at 30 days remaining.

Alerting:
- Renewal failure MUST page operator. Hook script at `/etc/letsencrypt/renewal-hooks/post/notify.sh` POSTs to Hub `/api/hub/alert` when `RENEWED_LINEAGE` is empty.
- Cloudflare uptime monitor for `https://hub.daveai.tech/api/hub/health` includes cert-expiry warning at 14 days remaining.

Cert files (`/etc/letsencrypt/`) are NEVER copied off VPS, NEVER added to git, NEVER baked into images.

---

## 6. Backup procedure for VPS state

Every deploy is gated on a successful backup.

```bash
export BACKUP_DIR="/root/daveai-backups/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

[ -d /etc/caddy ] && cp -a /etc/caddy "$BACKUP_DIR/caddy"
[ -d /etc/nginx ] && cp -a /etc/nginx "$BACKUP_DIR/nginx"
[ -d /var/www ] && cp -a /var/www "$BACKUP_DIR/var-www"
cp -a /opt/daveai "$BACKUP_DIR/opt-daveai"

docker ps --format '{{json .}}' > "$BACKUP_DIR/docker-ps.jsonl"
docker images --format '{{json .}}' > "$BACKUP_DIR/docker-images.jsonl"
docker compose -f /opt/daveai/docker-compose.yml config \
  > "$BACKUP_DIR/compose-resolved.yml"

( cd "$BACKUP_DIR" && find . -type f -print0 | xargs -0 sha256sum ) \
  > "$BACKUP_DIR/SHA256SUMS.txt"

echo "BACKUP_DIR=$BACKUP_DIR"
```

`BACKUP_DIR` and `SHA256SUMS.txt` are recorded in evidence per doc 04. No deploy command runs until `BACKUP_DIR` exists, `SHA256SUMS.txt` is non-empty, and the operator records backup proof.

Retention: keep last seven backups on disk; older pushed to off-VPS cold storage (operator-driven).

---

## 7. Deployment cadence

Per doc 23, prod deploys are built only from `release/*` branches. Per doc 29, working branches are canonical `feat/...` and never deployed.

**Forbidden deploy sources**: `main`, `master`, `integration/main`, any `feat/...`, any `fix/...`, any local-only branch.

```bash
# 7a. SSH in via §2; start session log
script -a /root/daveai-session-logs/$(date -u +%Y%m%d-%H%M%S).log

# 7b. Capture backup (§6). Abort if BACKUP_DIR empty.
[ -s "$BACKUP_DIR/SHA256SUMS.txt" ] || { echo "no backup proof; abort"; exit 1; }

# 7c. Pull pinned images (compose file already references release tags)
cd /opt/daveai
docker compose pull

# 7d. Apply
docker compose up -d --remove-orphans

# 7e. Health probe
curl -fsSL https://hub.daveai.tech/api/hub/health
docker compose ps
```

Image tags in `/opt/daveai/docker-compose.yml` MUST be edited to a concrete `vX.Y.Z` BEFORE `pull`. The edit is a git change in the `daveai-vps-config` repo, reviewed and committed on a `feat/deploy-vX.Y.Z` branch — never edited live on the VPS.

> ⚠️ **WARNING**: `docker compose up -d` recreates containers whose image/env/definition changed. Persistent data MUST live on a named volume; bind mounts to host paths are an audit finding.

---

## 8. Rollback procedure

### 8a. Single-service rollback (preferred)

Previous tags are in `$BACKUP_DIR/docker-images.jsonl` and `$BACKUP_DIR/compose-resolved.yml`.

```bash
# Edit /opt/daveai/docker-compose.yml so the affected service references
# the previous pinned tag (read from $BACKUP_DIR/compose-resolved.yml).
docker compose -f /opt/daveai/docker-compose.yml up -d --no-deps hub-backend
curl -fsSL https://hub.daveai.tech/api/hub/health
```

### 8b. Full rollback

```bash
docker compose -f /opt/daveai/docker-compose.yml down

cp -a "$BACKUP_DIR/opt-daveai/." /opt/daveai/
[ -d "$BACKUP_DIR/caddy" ] && cp -a "$BACKUP_DIR/caddy/." /etc/caddy/
[ -d "$BACKUP_DIR/nginx" ] && cp -a "$BACKUP_DIR/nginx/." /etc/nginx/

docker compose -f /opt/daveai/docker-compose.yml up -d
sudo systemctl reload caddy 2>/dev/null || sudo nginx -t && sudo systemctl reload nginx
```

> ⚠️ **WARNING**: 8b restores reverse-proxy config too. New subdomains added in the bad deploy disappear on rollback. Operators must communicate the regression window in the incident report.

After any rollback, file an incident report per doc 04.

---

## 9. Monitoring + alerting integration points

- **Hub-side health**: `GET https://hub.daveai.tech/api/hub/health` → `{"status":"ok","version":"vX.Y.Z","commit":"<40-hex>"}`. Cloudflare hits this every 60s; 3 consecutive failures pages operator.
- **Container-level healthchecks**: every service in `docker-compose.yml` MUST declare `healthcheck:`. `unhealthy` state is a deploy abort condition.
- **Cloudflare uptime**: monitors per public subdomain. TLS expiry warning at 14d. Origin error rate (5xx) >1% for 5min pages operator.
- **Reverse-proxy access logs**: ship via `journalctl` → `vector`. Retention 30d. NO Authorization headers or cookies in logs.
- **Hub `/api/hub/alert`**: single inbound webhook for VPS alerts. Authenticates via shared secret in `/opt/daveai/env/hub.env` mode `0600`.

---

## 10. Hostinger-specific gotchas

- **Web-terminal fallback**: SSH unreachable → use Hostinger's panel shell ONLY to restore SSH access; not for deploys (no audit log).
- **Firewall**: panel-level + OS-level (`ufw`/`nftables`) must agree. Inbound 80/443 from `0.0.0.0/0`; inbound 22 ideally restricted to operator IP allowlist; everything else closed.
- **Resource quotas**: `docker system df` and `df -h /` checked before every deploy. Weekly `docker image prune -a --filter 'until=168h'` cron prevents disk-fill.
- **Console reboot**: panel reboot is power-cycle equivalent; `restart: unless-stopped` services recover.
- **DNS**: apex `A` records can't be unproxied while needing direct origin access. Keep apex orange-clouded; use unproxied `origin.daveai.tech` for direct-origin tooling.

---

## 11. Forbidden actions

These are hard violations. Any one halts the run + triggers an incident report.

1. Editing files in `/etc/caddy`, `/etc/nginx`, or `/opt/daveai` without first capturing `BACKUP_DIR` per §6.
2. Deploying from `main`, `master`, `integration/main`, any `feat/...`, any `fix/...`, or any branch not matching `^release/.+`.
3. Pushing user work to `main` or `master` of any production-feeding repo.
4. Storing any secret in a Docker image layer, Dockerfile, compose file, or git-tracked file.
5. Committing/pushing `/etc/letsencrypt/`, `*.pem`, `privkey.pem`, `id_ed25519*` to git.
6. Running `docker compose down -v` on production stack (deletes named volumes = production data).
7. Running `docker system prune -a --volumes` on production VPS.
8. Bypassing the reverse proxy by binding a service to `0.0.0.0`.
9. Using Hostinger's web-terminal for a deploy session.
10. Issuing wildcard or apex certs from a non-production CA.

> ⚠️ **WARNING**: `docker compose down -v`, `rm -rf /opt/daveai`, `rm -rf /etc/letsencrypt`, and `ufw --force reset` are destructive. They MUST NOT run without explicit operator approval recorded in the evidence ledger AND a verified `BACKUP_DIR`.

---

## 12. Cross-references

- doc 04 — evidence ledger; backup proof + deploy proof recorded here.
- doc 23 — release branch shape, signed-tag, manifest publish at `/api/updates/manifest`.
- doc 27 — secrets handling rules referenced in §11.4 / §11.5.
- doc 28 — gates that MUST pass before production deploy proceeds.
- doc 29 — canonical `feat/...` branch naming.
- doc 35 — Docker container discipline.
- doc 37 — operator daily runbook (daily/weekly/monthly checks integrate with §9 monitoring).
