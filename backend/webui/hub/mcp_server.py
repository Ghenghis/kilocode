"""
Hub v2 — MCP server attachment.

Uses fastapi_mcp to auto-expose all FastAPI routes as MCP tools.
Mounted at /mcp — configure any MCP client with:
  { "url": "http://localhost:8095/mcp" }
"""
from fastapi import FastAPI


def attach_mcp(app: FastAPI, base_url: str = "http://localhost:8095") -> None:
    """Attach the MCP server to the FastAPI app. Safe no-op if fastapi_mcp not installed."""
    try:
        from fastapi_mcp import FastApiMCP
        mcp = FastApiMCP(
            app,
            name="Hub Control Plane",
            description=(
                "Hub v2 — universal control plane for KiloCode, Open WebUI, Hermes, "
                "ZeroClaw, providers, agents, pipelines, and infrastructure."
            ),
        )
        mcp.mount_http()
        print(f"[hub] MCP server mounted at {base_url}/mcp")
    except ImportError:
        print("[hub] WARNING: fastapi_mcp not installed — MCP endpoint unavailable. "
              "Run: pip install fastapi-mcp")
    except Exception as exc:
        print(f"[hub] WARNING: MCP setup failed: {exc}")
