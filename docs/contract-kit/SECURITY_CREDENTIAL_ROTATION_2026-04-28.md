# Security: Credential Rotation & History Purge
**Incident date:** 2026-04-27  
**Detected:** commit `2a695cd` — "feat: Phase 1.3 — VPS deploy scripts"  
**File exposed:** `deploy/vps/.env.production` (committed to public GitHub repo)  
**Status:** Local history purged ✅ — GitHub force-push **PENDING USER ACTION**

---

## Step 1 — Complete the GitHub History Purge

Local `git filter-repo` was run successfully. The file is gone from local history.
To remove it from GitHub (required — the old commits are still publicly visible):

```powershell
# Run this in PowerShell / bash from G:\Github\contract-kit-v17
git push origin integration/main --force-with-lease
git push origin --force-with-lease --tags
```

After pushing, also clear GitHub's cached views:
- Go to: https://github.com/Ghenghis/contract-kit-v17/settings → Danger Zone → "Request GitHub Support to purge cached data"
- Or open a GitHub support ticket requesting a cached-object purge for repo `Ghenghis/contract-kit-v17`

---

## Step 2 — Rotate ALL Leaked Credentials

> **Updated:** `deploy/.env.vps` was also git-tracked and contained additional live keys beyond the original 4. Total credentials requiring rotation: **8**.



**CRITICAL: Rotate these EVEN AFTER the history purge** — once a secret is public, assume it's compromised.

### 1. POSTGRES_PASSWORD
- **Where used:** `deploy/vps/docker-compose.production.yml`, your VPS PostgreSQL container
- **How to rotate:**
  1. SSH into your VPS
  2. `docker exec -it <postgres_container> psql -U postgres`
  3. `ALTER USER postgres PASSWORD 'NEW_STRONG_PASSWORD';`  
  4. Update `deploy/vps/.env.production` (local only, NOT git-tracked) with new value
  5. Restart containers: `docker compose -f deploy/vps/docker-compose.production.yml up -d`
- **Generate new password:** `openssl rand -base64 32`

### 2. MINIMAX_API_KEY
- **Provider:** MiniMax AI (minimaxi.com / api.minimax.chat)
- **How to rotate:**
  1. Log in at https://platform.minimaxi.com → API Keys
  2. Delete the exposed key
  3. Create a new key
  4. Update your local `.env.production` (not git-tracked) and any VPS env files
  5. Update Hermes router config that uses this key

### 3. SILICONFLOW_API_KEY  
- **Provider:** SiliconFlow (siliconflow.cn)
- **How to rotate:**
  1. Log in at https://cloud.siliconflow.cn → API Management
  2. Revoke the exposed key
  3. Generate a new key
  4. Update local `.env.production` and VPS env

### 4. WEBUI_SECRET_KEY
- **Used by:** Open WebUI for session signing / JWT
- **How to rotate:**
  1. Generate a new secret: `openssl rand -hex 32`
  2. Update `WEBUI_SECRET_KEY` in your VPS environment
  3. **Note:** This will invalidate all existing Open WebUI sessions — users will be logged out
  4. Restart Open WebUI container: `docker restart open-webui`

---

## Step 3 — Prevent Future Leaks

The `.gitignore` should already have `.env*` blocked. Verify:

```bash
grep -n "\.env" G:/Github/contract-kit-v17/.gitignore
```

Add a pre-commit hook to scan for secrets:

```bash
# G:/Github/contract-kit-v17/.git/hooks/pre-commit
#!/bin/sh
if git diff --cached --name-only | grep -E '\.env(\.|$)'; then
  echo "ERROR: .env file staged for commit. Remove it first."
  exit 1
fi
```

Or use `gitleaks` / `detect-secrets` for a fuller scan.

---

## Verification Checklist

- [ ] `git push origin integration/main --force-with-lease` completed
- [ ] GitHub shows `2a695cd` is no longer accessible
- [ ] POSTGRES_PASSWORD rotated on VPS
- [ ] MINIMAX_API_KEY revoked and new key issued
- [ ] SILICONFLOW_API_KEY revoked and new key issued
- [ ] WEBUI_SECRET_KEY regenerated, Open WebUI restarted
- [ ] All local `.env.production` files updated with new values
- [ ] `.gitignore` confirms `.env*` is blocked
- [ ] Pre-commit hook or gitleaks installed

---

## Backup Location

A mirror backup of the pre-purge repo state exists at:
```
G:\Github\contract-kit-v17-backup-20260427-211327.git
```
This backup **contains the original history including the exposed credentials** — keep it local only, never push or share.
