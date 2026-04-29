"""
title: KiloCode 20 Agents Pipeline
author: DaveAI
version: 1.0.0
description: Exposes all 20 KiloCode agents as selectable models in Open WebUI.
             Routes tasks to the correct agent based on content or explicit agent prefix.
             Agents: orchestrator, code-gen, reviewer, tester, debugger, refactorer,
             documenter, security, perf, architect, db, devops, frontend, backend,
             researcher, planner, integrator, data, ml, deployer.
             API: contract-kit dashboard at host.docker.internal:8787.
"""

from typing import List, Union, Generator, Iterator
from pydantic import BaseModel
import httpx
import json


DASHBOARD_URL = "http://host.docker.internal:8787"

AGENTS = {
    "kc-01": {"name": "Orchestrator",  "keywords": ["orchestrate", "coordinate", "manage", "assign", "delegate"]},
    "kc-02": {"name": "Code Gen",      "keywords": ["generate", "write code", "implement", "create function", "build"]},
    "kc-03": {"name": "Reviewer",      "keywords": ["review", "check", "audit", "evaluate", "assess", "critique"]},
    "kc-04": {"name": "Tester",        "keywords": ["test", "unit test", "spec", "coverage", "assert", "jest", "pytest"]},
    "kc-05": {"name": "Debugger",      "keywords": ["debug", "fix", "trace", "breakpoint", "exception", "stack trace"]},
    "kc-06": {"name": "Refactorer",    "keywords": ["refactor", "clean", "simplify", "optimize code", "restructure"]},
    "kc-07": {"name": "Documenter",    "keywords": ["document", "docs", "readme", "comment", "explain", "jsdoc"]},
    "kc-08": {"name": "Security",      "keywords": ["security", "vuln", "xss", "injection", "auth", "pentest", "cve"]},
    "kc-09": {"name": "Performance",   "keywords": ["performance", "speed", "slow", "benchmark", "cache", "optimize"]},
    "kc-10": {"name": "Architect",     "keywords": ["architect", "design pattern", "structure", "scalable", "microservice"]},
    "kc-11": {"name": "DB Specialist", "keywords": ["database", "sql", "query", "migration", "schema", "postgres", "index"]},
    "kc-12": {"name": "DevOps",        "keywords": ["deploy", "docker", "ci/cd", "kubernetes", "terraform", "ansible"]},
    "kc-13": {"name": "Frontend",      "keywords": ["frontend", "react", "vue", "css", "html", "ui", "component", "svelte"]},
    "kc-14": {"name": "Backend",       "keywords": ["backend", "api", "rest", "fastapi", "express", "server", "endpoint"]},
    "kc-15": {"name": "Researcher",    "keywords": ["research", "find", "search", "look up", "investigate", "discover"]},
    "kc-16": {"name": "Planner",       "keywords": ["plan", "roadmap", "milestone", "sprint", "backlog", "estimate"]},
    "kc-17": {"name": "Integrator",    "keywords": ["integrate", "connect", "webhook", "sync", "merge", "bridge"]},
    "kc-18": {"name": "Data Engineer", "keywords": ["data", "pipeline", "etl", "transform", "kafka", "spark", "pandas"]},
    "kc-19": {"name": "ML Engineer",   "keywords": ["machine learning", "model", "train", "inference", "pytorch", "llm"]},
    "kc-20": {"name": "Deployer",      "keywords": ["release", "publish", "ship", "rollout", "version", "tag", "npm publish"]},
}


def _route_to_agent(text: str) -> str:
    lower = text.lower()

    for agent_id, info in AGENTS.items():
        if lower.startswith(f"@{agent_id}") or lower.startswith(f"@{info['name'].lower()}"):
            return agent_id

    scores = {aid: sum(1 for kw in info["keywords"] if kw in lower) for aid, info in AGENTS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "kc-01"


class Pipeline:
    class Valves(BaseModel):
        dashboard_url: str = DASHBOARD_URL
        timeout_seconds: int = 60
        show_agent_name: bool = True

    def __init__(self):
        self.name = "KiloCode Agents"
        self.valves = self.Valves()

    async def on_startup(self):
        print(f"[KiloCode Agents] started — dashboard: {self.valves.dashboard_url}")

    async def on_shutdown(self):
        print("[KiloCode Agents] stopped")

    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: List[dict],
        body: dict,
    ) -> Union[str, Generator, Iterator]:
        agent_id = _route_to_agent(user_message)
        agent_info = AGENTS[agent_id]

        try:
            resp = httpx.post(
                f"{self.valves.dashboard_url}/api/agents/{agent_id}/assign",
                json={
                    "task": user_message,
                    "messages": messages,
                    "agent_id": agent_id,
                },
                timeout=self.valves.timeout_seconds,
            )
            if resp.status_code == 200:
                result = resp.json()
                reply = result.get("response") or result.get("result") or result.get("output", "")
                if not reply:
                    raise ValueError("empty response")
            else:
                raise ValueError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            reply = (
                f"*Agent `{agent_id}` ({agent_info['name']}) is not reachable at this time.*\n"
                f"Error: {e}\n\n"
                f"To use this agent directly, open the KiloCode hub at "
                f"`{self.valves.dashboard_url}` and assign it manually."
            )

        prefix = f"**[{agent_info['name']} — {agent_id}]**\n\n" if self.valves.show_agent_name else ""
        return f"{prefix}{reply}"

    def pipes(self) -> List[dict]:
        return [
            {"id": f"kc-agents-{aid}", "name": f"KC: {info['name']}"}
            for aid, info in AGENTS.items()
        ]
