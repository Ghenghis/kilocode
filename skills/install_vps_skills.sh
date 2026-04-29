#!/usr/bin/env bash
# install_vps_skills.sh — provisions ~/daveai/skills/* on the Hermes VPS.
#
# Usage (on VPS):
#   bash install_vps_skills.sh [SKILLS_ROOT]
#
# Default SKILLS_ROOT: ~/daveai/skills
# Idempotent: re-run is safe.
set -euo pipefail

SKILLS_ROOT="${1:-$HOME/daveai/skills}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[install_vps_skills] target = $SKILLS_ROOT"

mkdir -p "$SKILLS_ROOT"/{audits,evidence,quarantine,logs}

# Seed registry only if absent (preserve user state).
if [[ ! -f "$SKILLS_ROOT/registry.json" ]]; then
  if [[ -f "$SCRIPT_DIR/registry.seed.json" ]]; then
    cp "$SCRIPT_DIR/registry.seed.json" "$SKILLS_ROOT/registry.json"
    echo "[install_vps_skills] seeded registry.json from $SCRIPT_DIR/registry.seed.json"
  else
    cat > "$SKILLS_ROOT/registry.json" <<'JSON'
{ "version": "1.0.0", "skills": {} }
JSON
    echo "[install_vps_skills] wrote empty registry.json"
  fi
else
  echo "[install_vps_skills] registry.json already exists — leaving untouched"
fi

# Copy schema for reference.
if [[ -f "$SCRIPT_DIR/manifest.schema.json" ]]; then
  cp "$SCRIPT_DIR/manifest.schema.json" "$SKILLS_ROOT/manifest.schema.json"
  echo "[install_vps_skills] copied manifest.schema.json"
fi

# Quarantine the obliteratus skill explicitly so it cannot run from registry
# even if a manifest gets pushed in by mistake.
mkdir -p "$SKILLS_ROOT/quarantine"
cat > "$SKILLS_ROOT/quarantine/obliteratus.reason.txt" <<'TXT'
Obliteratus is a refusal-bypass / guardrail-removal research prompt.
DO NOT install for production.
This file is a permanent marker recognized by the Hub skills auditor.
TXT

# Sane perms: skills owned by the runtime user.
chmod -R u+rwX,go+rX "$SKILLS_ROOT"

echo "[install_vps_skills] done."
echo
echo "Next:"
echo "  1) Set SKILLS_ROOT in Hub env:    export SKILLS_ROOT=\"$SKILLS_ROOT\""
echo "  2) Restart Hub:                    sudo systemctl restart hub  # or pm2 restart hub"
echo "  3) Verify:                         curl -s http://localhost:8095/api/skills/health | jq ."
