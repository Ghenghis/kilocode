"""Shiba Memory Gateway — FastAPI service exposing recall/write/upsert endpoints.

Runtime entry point: ``backend.shiba.gateway_server:app``.

This package is intentionally light on imports so that the FastAPI app can
be imported without dragging in the rest of ``backend/``.
"""

__version__ = "0.1.0"

__all__ = ["__version__"]
