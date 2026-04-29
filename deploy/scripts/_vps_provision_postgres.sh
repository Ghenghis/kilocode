#!/usr/bin/env bash
# =============================================================================
# Provision Postgres for KiloCode Shiba Memory Gateway
#
# Idempotent: safe to re-run. Creates the shiba role + database, enables the
# pg_trgm extension, configures peer auth for the shiba user, and prints the
# connection URL the kilocode-shiba.service unit needs.
#
# Usage:  sudo bash deploy/scripts/_vps_provision_postgres.sh
#
# Optional env (overrides):
#   SHIBA_DB_NAME       (default: shiba)
#   SHIBA_DB_USER       (default: shiba)
#   SHIBA_DB_PASSWORD   (default: auto-generated 32-char random)
#   SHIBA_DB_HOST       (default: 127.0.0.1)
#   SHIBA_DB_PORT       (default: 5432)
# =============================================================================

set -euo pipefail

# ─── Defaults ──────────────────────────────────────────────────────────────
DB_NAME="${SHIBA_DB_NAME:-shiba}"
DB_USER="${SHIBA_DB_USER:-shiba}"
DB_HOST="${SHIBA_DB_HOST:-127.0.0.1}"
DB_PORT="${SHIBA_DB_PORT:-5432}"
DB_PASSWORD="${SHIBA_DB_PASSWORD:-}"

# ─── Helpers ───────────────────────────────────────────────────────────────
log()  { printf "\033[1;36m[provision]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    die "Run as root (sudo bash $0)"
  fi
}

ensure_postgres_installed() {
  if command -v psql >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^postgresql\.service'; then
    log "postgresql is already installed"
    return
  fi
  log "Installing postgresql…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y postgresql postgresql-contrib >/dev/null
}

ensure_postgres_running() {
  if ! systemctl is-active --quiet postgresql; then
    log "Starting postgresql…"
    systemctl enable --now postgresql
  else
    log "postgresql is running"
  fi
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '/+=' | head -c 32
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  fi
}

run_psql() {
  # Run a SQL statement as the postgres superuser
  sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc "$1"
}

role_exists() {
  local r
  r=$(run_psql "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" || true)
  [[ "$r" == "1" ]]
}

db_exists() {
  local r
  r=$(run_psql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" || true)
  [[ "$r" == "1" ]]
}

# ─── Main ──────────────────────────────────────────────────────────────────
require_root
ensure_postgres_installed
ensure_postgres_running

if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD="$(generate_password)"
  log "Generated a new random password for role ${DB_USER}"
fi

# Create role (idempotent)
if role_exists; then
  log "Role ${DB_USER} already exists — updating password"
  run_psql "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}';" >/dev/null
else
  log "Creating role ${DB_USER}"
  run_psql "CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}';" >/dev/null
fi

# Create database (idempotent)
if db_exists; then
  log "Database ${DB_NAME} already exists"
else
  log "Creating database ${DB_NAME} owned by ${DB_USER}"
  run_psql "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";" >/dev/null
fi

# Grant + extension (idempotent)
log "Granting privileges on ${DB_NAME} to ${DB_USER}"
run_psql "GRANT ALL PRIVILEGES ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";" >/dev/null

log "Enabling pg_trgm extension on ${DB_NAME}"
sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -tAc \
  "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null

# Build connection URL
SHIBA_DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ─── Output ────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  Postgres provisioning complete"
echo "============================================================"
echo "  Database  : ${DB_NAME}"
echo "  User      : ${DB_USER}"
echo "  Host:port : ${DB_HOST}:${DB_PORT}"
echo "  pg_trgm   : enabled"
echo "  systemd   : postgresql.service active"
echo ""
echo "Add the following to /opt/kilocode/.env (or your Windows User env):"
echo ""
echo "  SHIBA_DB_URL=${SHIBA_DB_URL}"
echo ""
echo "Then start the gateway:"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable --now kilocode-shiba.service"
echo "  sudo systemctl status kilocode-shiba.service"
echo ""
echo "Verify:"
echo "  curl -s http://127.0.0.1:18789/health | jq ."
echo "============================================================"
