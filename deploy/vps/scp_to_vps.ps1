# ── Contract Kit V17 — SCP deploy files to VPS (run from Windows) ───────────
# Usage: .\scp_to_vps.ps1
# Prereq: SSH key configured for root@187.77.30.206

$VPS = "root@187.77.30.206"
$DEPLOY_DIR = "G:\Github\contract-kit-v17\deploy\vps"

Write-Host "==> Uploading deploy scripts to VPS..." -ForegroundColor Cyan

# Create remote directory
ssh $VPS "mkdir -p /opt/contract-kit /tmp/ck-deploy"

# Upload all deploy files
scp "$DEPLOY_DIR\deploy.sh"                          "${VPS}:/tmp/ck-deploy/deploy.sh"
scp "$DEPLOY_DIR\docker-compose.production.yml"      "${VPS}:/tmp/ck-deploy/docker-compose.yml"
scp "$DEPLOY_DIR\.env.production"                    "${VPS}:/tmp/ck-deploy/.env.production"
scp "$DEPLOY_DIR\nginx.conf"                         "${VPS}:/tmp/ck-deploy/nginx.conf"
scp "$DEPLOY_DIR\nginx-hub.conf"                     "${VPS}:/tmp/ck-deploy/nginx-hub.conf"
scp "$DEPLOY_DIR\healthcheck.sh"                     "${VPS}:/tmp/ck-deploy/healthcheck.sh"
scp "$DEPLOY_DIR\systemd\contract-kit-stack.service" "${VPS}:/tmp/ck-deploy/contract-kit-stack.service"

# Upload hub.html
scp "G:\Github\contract-kit-v17\src\webui\hub.html"  "${VPS}:/tmp/ck-deploy/hub.html"

# Move files into place on VPS
ssh $VPS @"
cp /tmp/ck-deploy/docker-compose.yml         /opt/contract-kit/docker-compose.yml
cp /tmp/ck-deploy/nginx-hub.conf             /opt/contract-kit/nginx-hub.conf
cp /tmp/ck-deploy/hub.html                   /opt/contract-kit/webui/hub.html
cp /tmp/ck-deploy/nginx.conf                 /etc/nginx/sites-available/contract-kit.conf
ln -sf /etc/nginx/sites-available/contract-kit.conf /etc/nginx/sites-enabled/contract-kit.conf
cp /tmp/ck-deploy/contract-kit-stack.service /etc/systemd/system/contract-kit-stack.service
chmod +x /tmp/ck-deploy/deploy.sh /tmp/ck-deploy/healthcheck.sh
cp /tmp/ck-deploy/healthcheck.sh             /opt/contract-kit/healthcheck.sh

# Only copy .env template if .env does not exist yet
[ -f /opt/contract-kit/.env ] || cp /tmp/ck-deploy/.env.production /opt/contract-kit/.env

# Reload systemd + nginx
systemctl daemon-reload
systemctl enable contract-kit-stack
nginx -t && systemctl reload nginx || true

echo 'Upload complete.'
"@

Write-Host ""
Write-Host "==> Done! Next steps on VPS:" -ForegroundColor Green
Write-Host "  1. ssh $VPS"
Write-Host "  2. nano /opt/contract-kit/.env   # add API keys"
Write-Host "  3. bash /tmp/ck-deploy/deploy.sh  # pull images + start stack"
Write-Host "  4. bash /opt/contract-kit/healthcheck.sh  # verify all services"
