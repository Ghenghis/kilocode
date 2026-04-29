"""
title: ZeroClaw Task Pipeline
author: DaveAI
version: 1.0.0
description: Submit and manage ZeroClaw autonomous tasks from Open WebUI chat.
             Parse natural language into structured task submissions with risk/policy controls.
             API: POST /kilocode/zeroclaw/tasks on the contract-kit settings server.
"""

from typing import List, Union, Generator, Iterator
from pydantic import BaseModel
import httpx
import json
import re


SETTINGS_URL = "http://host.docker.internal:7575"


def _parse_task(text: str) -> dict:
    lower = text.lower()

    risk = "low"
    if any(w in lower for w in ["dangerous", "production", "delete", "drop", "wipe", "destroy"]):
        risk = "high"
    elif any(w in lower for w in ["modify", "change", "update", "write", "create"]):
        risk = "medium"

    network = "deny"
    if any(w in lower for w in ["fetch", "download", "api", "http", "internet", "web"]):
        network = "open"

    write = "read_only"
    if risk == "high":
        write = "approved"
    elif risk == "medium":
        write = "buffered"

    path_match = re.search(r'(?:in|at|path|project)[:\s]+([/\w\-\.]+)', text, re.IGNORECASE)
    project_path = path_match.group(1) if path_match else "/opt/data"

    timeout = 300
    t_match = re.search(r'(\d+)\s*(?:sec|second|min|minute)', text, re.IGNORECASE)
    if t_match:
        val = int(t_match.group(1))
        timeout = val * 60 if "min" in text[t_match.start():t_match.end()].lower() else val

    return {
        "description": text,
        "projectPath": project_path,
        "riskLevel": risk,
        "networkPolicy": network,
        "writePolicy": write,
        "workspaceScope": [],
        "limits": {"timeoutSec": timeout, "memoryMb": 512, "cpu": 1},
    }


class Pipeline:
    class Valves(BaseModel):
        settings_url: str = SETTINGS_URL
        timeout_seconds: int = 30

    def __init__(self):
        self.name = "ZeroClaw Tasks"
        self.valves = self.Valves()

    async def on_startup(self):
        print(f"[ZeroClaw Pipeline] started — settings: {self.valves.settings_url}")

    async def on_shutdown(self):
        print("[ZeroClaw Pipeline] stopped")

    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: List[dict],
        body: dict,
    ) -> Union[str, Generator, Iterator]:
        lower = user_message.lower()

        if any(w in lower for w in ["list tasks", "show tasks", "queue", "status"]):
            try:
                resp = httpx.get(
                    f"{self.valves.settings_url}/kilocode/zeroclaw/tasks",
                    timeout=self.valves.timeout_seconds,
                )
                tasks = resp.json().get("tasks", []) if resp.status_code == 200 else []
                if not tasks:
                    return "**[ZeroClaw Queue]** No tasks queued."
                lines = [f"**[ZeroClaw Queue]** {len(tasks)} task(s):\n"]
                for t in tasks[:10]:
                    lines.append(f"- `{t['taskId'][:8]}` [{t['status']}] {t['description'][:60]}")
                return "\n".join(lines)
            except Exception as e:
                return f"**[ZeroClaw]** Error fetching tasks: {e}"

        task = _parse_task(user_message)
        try:
            resp = httpx.post(
                f"{self.valves.settings_url}/kilocode/zeroclaw/tasks",
                json=task,
                timeout=self.valves.timeout_seconds,
            )
            result = resp.json() if resp.status_code == 200 else {"error": resp.text}
        except Exception as e:
            result = {"error": str(e)}

        if result.get("error"):
            return f"**[ZeroClaw]** Error: {result['error']}"

        task_id = result.get("taskId", "unknown")
        return (
            f"**[ZeroClaw Task Submitted]** ✅\n\n"
            f"- **Task ID**: `{task_id}`\n"
            f"- **Risk**: {task['riskLevel']}\n"
            f"- **Network**: {task['networkPolicy']}\n"
            f"- **Write Policy**: {task['writePolicy']}\n"
            f"- **Path**: `{task['projectPath']}`\n"
            f"- **Timeout**: {task['limits']['timeoutSec']}s\n\n"
            f"Task is now **{result.get('status', 'queued')}**."
        )
