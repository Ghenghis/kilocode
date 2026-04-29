"""Hub v2 — shared async HTTP helper."""
import asyncio
from typing import Any, Optional
import httpx
from backend.webui.hub.config import TIMEOUT


async def _req(method: str, url: str, body: Optional[dict] = None) -> dict:
    """Fire an HTTP request; always returns a dict (never raises)."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            if method == "GET":
                r = await client.get(url)
            elif method == "POST":
                r = await client.post(url, json=body or {})
            elif method == "PUT":
                r = await client.put(url, json=body or {})
            elif method == "DELETE":
                r = await client.delete(url)
            else:
                return {"error": f"unsupported method: {method}"}
            try:
                return r.json()
            except Exception:
                return {"status_code": r.status_code, "text": r.text[:500]}
    except Exception as exc:
        return {"error": str(exc)}
