"""Pydantic v2 schemas for the Shiba Memory Gateway."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MemoryEntry(BaseModel):
    """A single memory record returned by the gateway.

    ``score`` is populated only on recall responses (similarity score). On
    write responses it is left at ``None``.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    content: str
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    score: float | None = None
    created_at: float
    updated_at: float


class WriteRequest(BaseModel):
    """Body schema for ``POST /write``.

    When ``id`` is supplied this acts as an upsert (last-write-wins by
    ``updated_at``). When ``id`` is absent the server generates a UUID4 hex.
    """

    model_config = ConfigDict(extra="ignore")

    content: str
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    id: str | None = None
    created_at: float | None = None
    updated_at: float | None = None


class WriteResponse(BaseModel):
    id: str
    created: bool


class RecallRequest(BaseModel):
    """Body schema for ``POST /recall``."""

    model_config = ConfigDict(extra="ignore")

    query: str
    limit: int = 10
    threshold: float = 0.0


class RecallResponse(BaseModel):
    memories: list[MemoryEntry]
    total: int
