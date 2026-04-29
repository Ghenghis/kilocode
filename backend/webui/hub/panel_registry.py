"""
Hub v2 — Panel registry.

Scans the panels/ directory for *.js files and builds a manifest.
GET /panels/manifest.json returns the list of panel modules for shell.html to load.

Adding a new panel: drop a .js file in panels/ — it appears automatically.
"""
import os
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse, FileResponse

PANELS_DIR = Path(__file__).parent.parent / "panels"


def _build_manifest() -> list[dict]:
    """Scan panels/ and return metadata for each panel module."""
    if not PANELS_DIR.exists():
        return []
    entries = []
    for js_file in sorted(PANELS_DIR.glob("*.js")):
        name = js_file.stem
        if name == "core":
            continue  # core is loaded first by shell, not via manifest
        entries.append({
            "id": name,
            "url": f"/panels/{js_file.name}",
            "file": js_file.name,
        })
    return entries


def create_router() -> APIRouter:
    router = APIRouter(prefix="/panels", tags=["panels"])

    @router.get("/manifest.json")
    async def panel_manifest():
        return JSONResponse({"panels": _build_manifest()})

    @router.get("/{filename}")
    async def serve_panel(filename: str):
        file_path = PANELS_DIR / filename
        if not file_path.exists() or not filename.endswith(".js"):
            from fastapi import HTTPException
            raise HTTPException(404, f"Panel not found: {filename}")
        return FileResponse(file_path, media_type="application/javascript")

    return router
