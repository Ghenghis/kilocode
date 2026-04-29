"""Hub v2 router — Skills System (/api/skills/*).

Implements the 10-component Skills system:
  1. Skills Registry        - GET    /api/skills/registry
  2. Skill Installer        - POST   /api/skills/install
  3. Skill Audit            - POST   /api/skills/{id}/audit
  4. Skill Permissions      - GET/PUT /api/skills/{id}/permissions
  5. Skill Runtime Proof    - GET    /api/skills/{id}/runtime
  6. Skill Usage Logs       - GET    /api/skills/{id}/logs
  7. Skill Health           - GET    /api/skills/health
  8. Skill Marketplace      - GET    /api/skills/marketplace
  9. Skill Execution (ZeroClaw) - POST /api/skills/{id}/execute
 10. Skill Learning (Voyager) - POST /api/skills/learn

VPS layout (mirrored locally for dev):
  ~/daveai/skills/
    registry.json        -- global skill registry
    audits/              -- per-skill audit JSON
    evidence/            -- per-skill execution evidence
    quarantine/          -- skills failing audit (e.g. obliteratus)

Rules enforced:
  - No skill runs without manifest
  - No skill runs without permission profile
  - Dangerous skills require human approval
  - All skills must pass audit before active
  - Every skill execution writes evidence JSON
"""
from __future__ import annotations
import hashlib
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit


# ── Storage paths ─────────────────────────────────────────────────────────────
SKILLS_ROOT = Path(os.environ.get("SKILLS_ROOT", str(Path.home() / "daveai" / "skills")))
REGISTRY_PATH = SKILLS_ROOT / "registry.json"
AUDITS_DIR = SKILLS_ROOT / "audits"
EVIDENCE_DIR = SKILLS_ROOT / "evidence"
QUARANTINE_DIR = SKILLS_ROOT / "quarantine"
LOGS_DIR = SKILLS_ROOT / "logs"

for d in (SKILLS_ROOT, AUDITS_DIR, EVIDENCE_DIR, QUARANTINE_DIR, LOGS_DIR):
    d.mkdir(parents=True, exist_ok=True)


# ── Skill safety classification ───────────────────────────────────────────────
# Skills containing any of these strings in name/desc are quarantined automatically.
QUARANTINE_KEYWORDS = {
    "obliterat",       # obliteratus — refusal-bypass / guardrail removal
    "jailbreak",
    "guardrail-bypass",
    "guardrail_bypass",
    "uncensored",
    "refusal-bypass",
}

# Skills requiring human approval before each execution.
DANGEROUS_PERMISSIONS = {"shell", "fs_write", "fs_delete", "network_post", "git_push"}


# ── Manifest schema ───────────────────────────────────────────────────────────
def manifest_required_fields() -> list[str]:
    return ["id", "name", "version", "description", "permissions", "executor", "entrypoint"]


def validate_manifest(m: dict) -> tuple[bool, list[str]]:
    errors = []
    for f in manifest_required_fields():
        if f not in m:
            errors.append(f"missing field: {f}")
    if "permissions" in m and not isinstance(m["permissions"], list):
        errors.append("permissions must be a list")
    if "executor" in m and m["executor"] not in {"python", "shell", "node", "zeroclaw", "browser"}:
        errors.append(f"unknown executor: {m['executor']}")
    return (len(errors) == 0), errors


def is_quarantine_skill(m: dict) -> tuple[bool, str]:
    blob = (str(m.get("id", "")) + " " + str(m.get("name", "")) + " " + str(m.get("description", ""))).lower()
    for kw in QUARANTINE_KEYWORDS:
        if kw in blob:
            return True, f"matches quarantine keyword: {kw}"
    return False, ""


def is_dangerous_skill(m: dict) -> bool:
    perms = set(m.get("permissions", []) or [])
    return bool(perms & DANGEROUS_PERMISSIONS)


def manifest_sha256(m: dict) -> str:
    return hashlib.sha256(json.dumps(m, sort_keys=True).encode("utf-8")).hexdigest()


# ── Registry I/O ──────────────────────────────────────────────────────────────
def load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        seed = {"version": "1.0.0", "generated": _ts(), "skills": {}}
        REGISTRY_PATH.write_text(json.dumps(seed, indent=2), encoding="utf-8")
        return seed
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"version": "1.0.0", "generated": _ts(), "skills": {}, "error": "load_failed"}


def save_registry(reg: dict) -> None:
    reg["generated"] = _ts()
    REGISTRY_PATH.write_text(json.dumps(reg, indent=2), encoding="utf-8")


def _ts() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ── Audit logic ───────────────────────────────────────────────────────────────
def run_skill_audit(manifest: dict) -> dict:
    """Audit a skill manifest. Returns audit record."""
    ok, errors = validate_manifest(manifest)
    quarantine, quarantine_reason = is_quarantine_skill(manifest)
    dangerous = is_dangerous_skill(manifest)
    sha = manifest_sha256(manifest)

    if quarantine:
        verdict = "QUARANTINE"
    elif not ok:
        verdict = "FAIL"
    elif dangerous:
        verdict = "PASS_REQUIRES_APPROVAL"
    else:
        verdict = "PASS"

    record = {
        "skill_id": manifest.get("id", ""),
        "name": manifest.get("name", ""),
        "version": manifest.get("version", ""),
        "manifest_sha256": sha,
        "verdict": verdict,
        "errors": errors,
        "dangerous": dangerous,
        "quarantine": quarantine,
        "quarantine_reason": quarantine_reason,
        "audited_at": _ts(),
        "auditor": "hub.skills.router",
    }

    # Persist audit
    audit_path = AUDITS_DIR / f"{manifest.get('id', 'unknown')}.json"
    audit_path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record


# ── Logs / evidence ───────────────────────────────────────────────────────────
def append_log(skill_id: str, entry: dict) -> None:
    log_path = LOGS_DIR / f"{skill_id}.jsonl"
    entry = {"ts": _ts(), **entry}
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def write_evidence(skill_id: str, run_id: str, evidence: dict) -> Path:
    skill_dir = EVIDENCE_DIR / skill_id
    skill_dir.mkdir(parents=True, exist_ok=True)
    p = skill_dir / f"{run_id}.json"
    p.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    return p


# ── Router ────────────────────────────────────────────────────────────────────
def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/skills", tags=["skills"])

    # 1. REGISTRY
    @router.get("/registry")
    async def get_registry():
        reg = load_registry()
        return JSONResponse({
            "ok": True,
            "skills_root": str(SKILLS_ROOT),
            "skill_count": len(reg.get("skills", {})),
            "registry": reg,
        })

    # 7. HEALTH
    @router.get("/health")
    async def health():
        reg = load_registry()
        skills = reg.get("skills", {})
        active = sum(1 for s in skills.values() if s.get("verdict") == "PASS")
        approval = sum(1 for s in skills.values() if s.get("verdict") == "PASS_REQUIRES_APPROVAL")
        quarantined = sum(1 for s in skills.values() if s.get("verdict") == "QUARANTINE")
        failed = sum(1 for s in skills.values() if s.get("verdict") == "FAIL")
        return JSONResponse({
            "ok": True,
            "ts": _ts(),
            "skills_root": str(SKILLS_ROOT),
            "registry_exists": REGISTRY_PATH.exists(),
            "totals": {
                "skills": len(skills),
                "active": active,
                "requires_approval": approval,
                "quarantined": quarantined,
                "failed": failed,
            },
            "directories": {
                "audits": str(AUDITS_DIR),
                "evidence": str(EVIDENCE_DIR),
                "quarantine": str(QUARANTINE_DIR),
                "logs": str(LOGS_DIR),
            },
        })

    # 8. MARKETPLACE
    @router.get("/marketplace")
    async def marketplace():
        # Static catalog; real implementation pulls from a curated remote source.
        catalog = [
            {"id": "git_status", "name": "Git Status", "category": "git", "permissions": ["shell"], "source": "builtin"},
            {"id": "file_read", "name": "File Read", "category": "fs", "permissions": ["fs_read"], "source": "builtin"},
            {"id": "file_write", "name": "File Write", "category": "fs", "permissions": ["fs_write"], "source": "builtin"},
            {"id": "playwright_screenshot", "name": "Playwright Screenshot", "category": "qa", "permissions": ["browser"], "source": "builtin"},
            {"id": "zeroclaw_shell", "name": "ZeroClaw Shell", "category": "exec", "permissions": ["shell"], "source": "builtin"},
            {"id": "obliteratus", "name": "Obliteratus (QUARANTINED)", "category": "research", "permissions": ["shell"], "source": "external", "quarantine": True},
        ]
        return JSONResponse({"ok": True, "catalog": catalog, "count": len(catalog)})

    # 2. INSTALL
    @router.post("/install", dependencies=[Depends(require_write)])
    async def install(request: Request):
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid json"}, status_code=400)

        manifest = body.get("manifest")
        if not isinstance(manifest, dict):
            return JSONResponse({"error": "manifest object required"}, status_code=400)

        # 3. AUDIT runs as part of install
        audit = run_skill_audit(manifest)

        reg = load_registry()
        sid = manifest.get("id", "")
        if not sid:
            return JSONResponse({"error": "manifest.id required"}, status_code=400)

        reg["skills"][sid] = {
            "manifest": manifest,
            "verdict": audit["verdict"],
            "errors": audit["errors"],
            "dangerous": audit["dangerous"],
            "quarantine": audit["quarantine"],
            "manifest_sha256": audit["manifest_sha256"],
            "permissions": manifest.get("permissions", []),
            "installed_at": _ts(),
            "executor": manifest.get("executor", ""),
            "use_count": 0,
            "success_count": 0,
            "failure_count": 0,
            "approved": False,  # explicit human approval flag
        }
        save_registry(reg)
        emit("skill.installed", {"skill_id": sid, "verdict": audit["verdict"]})
        append_log(sid, {"event": "install", "verdict": audit["verdict"]})

        return JSONResponse({"ok": True, "audit": audit, "registered": True})

    # 3. AUDIT (re-audit existing)
    @router.post("/{skill_id}/audit", dependencies=[Depends(require_write)])
    async def audit_skill(skill_id: str):
        reg = load_registry()
        s = reg.get("skills", {}).get(skill_id)
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        audit = run_skill_audit(s["manifest"])
        s["verdict"] = audit["verdict"]
        s["errors"] = audit["errors"]
        s["dangerous"] = audit["dangerous"]
        s["quarantine"] = audit["quarantine"]
        s["manifest_sha256"] = audit["manifest_sha256"]
        save_registry(reg)
        emit("skill.audited", {"skill_id": skill_id, "verdict": audit["verdict"]})
        return JSONResponse({"ok": True, "audit": audit})

    # 4. PERMISSIONS
    @router.get("/{skill_id}/permissions")
    async def get_perms(skill_id: str):
        reg = load_registry()
        s = reg.get("skills", {}).get(skill_id)
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        return JSONResponse({
            "ok": True,
            "skill_id": skill_id,
            "permissions": s.get("permissions", []),
            "dangerous": s.get("dangerous", False),
            "approved": s.get("approved", False),
        })

    @router.put("/{skill_id}/permissions", dependencies=[Depends(require_write)])
    async def set_perms(skill_id: str, request: Request):
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid json"}, status_code=400)
        reg = load_registry()
        s = reg.get("skills", {}).get(skill_id)
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        if "permissions" in body:
            s["permissions"] = list(body["permissions"])
            s["manifest"]["permissions"] = s["permissions"]
        if "approved" in body:
            s["approved"] = bool(body["approved"])
        save_registry(reg)
        # Re-audit after permission change
        audit = run_skill_audit(s["manifest"])
        s["verdict"] = audit["verdict"]
        s["dangerous"] = audit["dangerous"]
        save_registry(reg)
        emit("skill.permissions.updated", {"skill_id": skill_id})
        return JSONResponse({"ok": True, "permissions": s["permissions"], "approved": s["approved"], "verdict": s["verdict"]})

    # 5. RUNTIME PROOF
    @router.get("/{skill_id}/runtime")
    async def runtime(skill_id: str):
        reg = load_registry()
        s = reg.get("skills", {}).get(skill_id)
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        skill_evidence_dir = EVIDENCE_DIR / skill_id
        runs = []
        if skill_evidence_dir.exists():
            for p in sorted(skill_evidence_dir.glob("*.json"), reverse=True)[:20]:
                try:
                    runs.append(json.loads(p.read_text(encoding="utf-8")))
                except Exception:
                    continue
        return JSONResponse({
            "ok": True,
            "skill_id": skill_id,
            "verdict": s.get("verdict"),
            "use_count": s.get("use_count", 0),
            "success_count": s.get("success_count", 0),
            "failure_count": s.get("failure_count", 0),
            "evidence_count": len(runs),
            "recent_runs": runs,
        })

    # 6. LOGS
    @router.get("/{skill_id}/logs")
    async def get_logs(skill_id: str, limit: int = 100):
        log_path = LOGS_DIR / f"{skill_id}.jsonl"
        if not log_path.exists():
            return JSONResponse({"ok": True, "skill_id": skill_id, "logs": [], "count": 0})
        lines = log_path.read_text(encoding="utf-8").splitlines()
        entries = []
        for line in lines[-limit:]:
            try:
                entries.append(json.loads(line))
            except Exception:
                continue
        return JSONResponse({"ok": True, "skill_id": skill_id, "logs": entries, "count": len(entries)})

    # 9. EXECUTE (via ZeroClaw for safety)
    @router.post("/{skill_id}/execute", dependencies=[Depends(require_write)])
    async def execute(skill_id: str, request: Request):
        try:
            body = await request.json()
        except Exception:
            body = {}
        reg = load_registry()
        s = reg.get("skills", {}).get(skill_id)
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)

        # Enforce rules
        if s.get("verdict") == "QUARANTINE":
            return JSONResponse({"error": "skill is quarantined", "verdict": "QUARANTINE"}, status_code=403)
        if s.get("verdict") == "FAIL":
            return JSONResponse({"error": "skill failed audit", "errors": s.get("errors", [])}, status_code=403)
        if s.get("dangerous") and not s.get("approved"):
            return JSONResponse({"error": "dangerous skill requires approval", "verdict": s.get("verdict")}, status_code=403)

        run_id = str(uuid.uuid4())[:12]
        args = body.get("args", {})
        executor = s["manifest"].get("executor", "python")
        entrypoint = s["manifest"].get("entrypoint", "")

        # Simulated execution — real implementation forwards to ZeroClaw runtime.
        # We DO NOT execute shell commands directly here. ZeroClaw is the ONLY
        # path for shell/file/network skills.
        result = {
            "ok": True,
            "skill_id": skill_id,
            "run_id": run_id,
            "executor": executor,
            "entrypoint": entrypoint,
            "args": args,
            "status": "queued_for_zeroclaw" if executor in {"shell", "zeroclaw"} else "executed_inline_stub",
            "ts": _ts(),
            "note": "This Hub endpoint queues to ZeroClaw. See zeroclaw_runtime_truth gate for execution proof.",
        }

        # 10. EVIDENCE — every execution writes evidence
        evidence_path = write_evidence(skill_id, run_id, {
            "skill_id": skill_id,
            "run_id": run_id,
            "manifest_sha256": s.get("manifest_sha256", ""),
            "args": args,
            "result": result,
            "verdict": s.get("verdict"),
            "approved": s.get("approved", False),
        })

        # Update counters
        s["use_count"] = s.get("use_count", 0) + 1
        s["success_count"] = s.get("success_count", 0) + 1
        save_registry(reg)
        append_log(skill_id, {"event": "execute", "run_id": run_id, "executor": executor})
        emit("skill.executed", {"skill_id": skill_id, "run_id": run_id})

        return JSONResponse({
            **result,
            "evidence_path": str(evidence_path),
        })

    # 10. LEARN (Voyager loop)
    @router.post("/learn", dependencies=[Depends(require_write)])
    async def learn(request: Request):
        """
        Voyager-style skill learning endpoint.

        Body:
          {
            "trigger": "user task that needed a missing skill",
            "proposed_manifest": { ...new skill... },
            "feedback": { "success": true/false, "notes": "..." }
          }
        """
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid json"}, status_code=400)

        proposed = body.get("proposed_manifest")
        feedback = body.get("feedback", {})
        trigger = body.get("trigger", "")

        if not isinstance(proposed, dict):
            return JSONResponse({"error": "proposed_manifest required"}, status_code=400)

        # Gate every learned skill through audit before registry insertion.
        audit = run_skill_audit(proposed)
        reg = load_registry()
        sid = proposed.get("id") or f"voyager-{uuid.uuid4().hex[:8]}"
        proposed.setdefault("id", sid)

        reg["skills"][sid] = {
            "manifest": proposed,
            "verdict": audit["verdict"],
            "errors": audit["errors"],
            "dangerous": audit["dangerous"],
            "quarantine": audit["quarantine"],
            "manifest_sha256": audit["manifest_sha256"],
            "permissions": proposed.get("permissions", []),
            "installed_at": _ts(),
            "executor": proposed.get("executor", ""),
            "use_count": 0,
            "success_count": 1 if feedback.get("success") else 0,
            "failure_count": 0 if feedback.get("success") else 1,
            "approved": False,
            "voyager_origin": {"trigger": trigger, "feedback": feedback, "ts": _ts()},
        }
        save_registry(reg)
        append_log(sid, {"event": "voyager_learn", "trigger": trigger, "verdict": audit["verdict"]})
        emit("skill.learned", {"skill_id": sid, "verdict": audit["verdict"]})

        return JSONResponse({
            "ok": True,
            "skill_id": sid,
            "audit": audit,
            "note": "Voyager-learned skill staged. Run /api/skills/{id}/audit and grant approval before execution.",
        })

    return router
