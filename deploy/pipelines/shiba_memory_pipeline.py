"""
title: Shiba Memory Pipeline
author: DaveAI
version: 1.0.0
description: Injects Shiba long-term memory context into every Open WebUI conversation.
             Recalls relevant memories before responding and writes new memories after.
             Connects to Shiba Gateway at host.docker.internal:18789.
"""

from typing import List, Union, Generator, Iterator
from pydantic import BaseModel
import httpx
import json


SHIBA_URL = "http://host.docker.internal:18789"


class Pipeline:
    class Valves(BaseModel):
        shiba_url: str = SHIBA_URL
        max_memories: int = 5
        memory_threshold: float = 0.3
        timeout_seconds: int = 10
        write_memories: bool = True

    def __init__(self):
        self.name = "Shiba Memory"
        self.valves = self.Valves()

    async def on_startup(self):
        print(f"[Shiba Memory] started — shiba: {self.valves.shiba_url}")

    async def on_shutdown(self):
        print("[Shiba Memory] stopped")

    def _recall(self, query: str) -> list:
        try:
            resp = httpx.post(
                f"{self.valves.shiba_url}/recall",
                json={"query": query, "limit": self.valves.max_memories},
                timeout=self.valves.timeout_seconds,
            )
            if resp.status_code == 200:
                data = resp.json()
                memories = data.get("memories") or data.get("results") or []
                return [m for m in memories if m.get("score", 1.0) >= self.valves.memory_threshold]
        except Exception:
            pass
        return []

    def _write(self, content: str, tags: list = None) -> None:
        if not self.valves.write_memories:
            return
        try:
            httpx.post(
                f"{self.valves.shiba_url}/write",
                json={"content": content, "tags": tags or ["webui", "conversation"]},
                timeout=self.valves.timeout_seconds,
            )
        except Exception:
            pass

    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: List[dict],
        body: dict,
    ) -> Union[str, Generator, Iterator]:
        memories = self._recall(user_message)

        if memories:
            mem_block = "\n".join(
                f"- {m.get('content', m.get('text', str(m)))}" for m in memories
            )
            context = (
                f"**[Shiba Memory Context]**\n{mem_block}\n\n"
                f"---\n**User:** {user_message}"
            )
        else:
            context = user_message

        if self.valves.write_memories and len(user_message) > 20:
            self._write(user_message, tags=["webui", "user-input"])

        return context
