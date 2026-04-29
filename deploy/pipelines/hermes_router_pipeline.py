"""
title: Hermes Router Pipeline
author: DaveAI
version: 2.0.0
description: Routes chat to the correct Hermes bot (hermes1-5) for research/planning/triage,
             then uses MiniMax MiniMax-Text-01 as the actual response model.
             Hermes bots gather context (research, patterns, repo analysis) and
             MiniMax synthesizes the final answer. Shiba Memory filter runs on top of this.
"""

from typing import List, Union, Generator, Iterator
from pydantic import BaseModel
import httpx
import json


HERMES_BASE = "http://host.docker.internal:18789"
MINIMAX_BASE = "https://api.minimax.chat/v1"

CHANNEL_MAP = {
    "hermes1": {"channel": "general",  "role": "Planning Strategist",   "keywords": ["plan", "strategy", "roadmap", "goal", "task", "todo", "sprint", "milestone"]},
    "hermes2": {"channel": "planning",  "role": "Creative Brainstormer",  "keywords": ["idea", "brainstorm", "creative", "concept", "innovate", "explore"]},
    "hermes3": {"channel": "design",    "role": "System Architect",       "keywords": ["architect", "design", "system", "structure", "schema", "infra", "pattern"]},
    "hermes4": {"channel": "issues",    "role": "Bug Triage Specialist",  "keywords": ["bug", "error", "issue", "fix", "broken", "fail", "crash", "exception"]},
    "hermes5": {"channel": "problems",  "role": "Root Cause Analyst",     "keywords": ["root cause", "why", "cause", "investigate", "diagnose", "problem", "analyse"]},
}


def _route_message(text: str) -> str:
    lower = text.lower()
    scores = {bot: sum(1 for kw in info["keywords"] if kw in lower) for bot, info in CHANNEL_MAP.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "hermes1"


class Pipeline:
    class Valves(BaseModel):
        hermes_base_url: str = HERMES_BASE
        minimax_api_key: str = ""
        minimax_base_url: str = MINIMAX_BASE
        minimax_model: str = "MiniMax-Text-01"
        timeout_seconds: int = 45
        use_minimax_response: bool = True

    def __init__(self):
        self.name = "Hermes Router"
        self.valves = self.Valves()

    async def on_startup(self):
        print(f"[Hermes Router] started — hermes: {self.valves.hermes_base_url}")

    async def on_shutdown(self):
        print("[Hermes Router] stopped")

    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: List[dict],
        body: dict,
    ) -> Union[str, Generator, Iterator]:
        bot = _route_message(user_message)
        info = CHANNEL_MAP[bot]

        hermes_context = ""
        try:
            resp = httpx.post(
                f"{self.valves.hermes_base_url}/intake",
                json={"bot": bot, "message": user_message, "channel": info["channel"]},
                timeout=self.valves.timeout_seconds,
            )
            if resp.status_code == 200:
                result = resp.json()
                hermes_context = result.get("reply") or result.get("response") or ""
        except Exception as e:
            hermes_context = f"(Hermes offline: {e})"

        if self.valves.use_minimax_response and self.valves.minimax_api_key:
            system_content = (
                f"You are a highly capable AI assistant with the role of {info['role']}. "
                f"Use the research context below gathered by the Hermes network to give the best possible answer."
            )
            if hermes_context:
                system_content += f"\n\nHermes Research Context:\n{hermes_context}"

            mm_messages = [{"role": "system", "content": system_content}]
            for m in messages:
                if m.get("role") in ("user", "assistant"):
                    mm_messages.append(m)

            try:
                mm_resp = httpx.post(
                    f"{self.valves.minimax_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.valves.minimax_api_key}"},
                    json={"model": self.valves.minimax_model, "messages": mm_messages},
                    timeout=self.valves.timeout_seconds,
                )
                if mm_resp.status_code == 200:
                    reply = mm_resp.json()["choices"][0]["message"]["content"]
                    return f"**[{info['role']} → MiniMax]**\n\n{reply}"
            except Exception as e:
                pass

        if hermes_context:
            return f"**[{info['role']} via #{info['channel']}]**\n\n{hermes_context}"
        return f"**[{info['role']}]** Hermes is processing your request. Check #{info['channel']} on Discord."
