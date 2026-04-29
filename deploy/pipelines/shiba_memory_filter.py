"""
title: Shiba Memory Filter
author: DaveAI
version: 1.0.0
description: Automatically injects Shiba long-term memory into EVERY conversation,
             regardless of which model is selected. Works as a filter (inlet/outlet)
             so MiniMax/SiliconFlow/any model gets memory context transparently.
             Also writes new user messages to memory after each turn.
"""

from pydantic import BaseModel
from typing import Optional
import httpx


SHIBA_URL = "http://host.docker.internal:18789"
SHIBA_KEY = "shiba-local-key"


class Filter:
    class Valves(BaseModel):
        shiba_url: str = SHIBA_URL
        shiba_key: str = SHIBA_KEY
        max_memories: int = 5
        enabled: bool = True
        write_memories: bool = True

    def __init__(self):
        self.valves = self.Valves()

    def _headers(self):
        return {"X-Shiba-Key": self.valves.shiba_key}

    def _recall(self, query: str) -> list:
        try:
            resp = httpx.post(
                f"{self.valves.shiba_url}/recall",
                json={"query": query, "limit": self.valves.max_memories},
                headers=self._headers(),
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("memories") or data.get("results") or []
        except Exception:
            pass
        return []

    def _write(self, content: str) -> None:
        if not self.valves.write_memories:
            return
        try:
            httpx.post(
                f"{self.valves.shiba_url}/write",
                json={"content": content, "tags": ["webui", "conversation"]},
                headers=self._headers(),
                timeout=5,
            )
        except Exception:
            pass

    def inlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        if not self.valves.enabled:
            return body

        messages = body.get("messages", [])
        if not messages:
            return body

        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            None,
        )
        if not last_user:
            return body

        memories = self._recall(last_user)
        if not memories:
            return body

        mem_lines = []
        for m in memories:
            text = m.get("content") or m.get("text") or str(m)
            mem_lines.append(f"- {text}")

        mem_block = (
            "The following memories from previous conversations are relevant:\n"
            + "\n".join(mem_lines)
            + "\n\nUse this context to give a better response."
        )

        system_msg = next(
            (m for m in messages if m.get("role") == "system"), None
        )
        if system_msg:
            system_msg["content"] = mem_block + "\n\n" + system_msg["content"]
        else:
            messages.insert(0, {"role": "system", "content": mem_block})

        body["messages"] = messages
        return body

    def outlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        if not self.valves.write_memories or not self.valves.enabled:
            return body

        messages = body.get("messages", [])
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            None,
        )
        if last_user and len(last_user) > 20:
            self._write(last_user)

        return body
