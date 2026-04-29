"""
title: Echo Test Pipeline
author: DaveAI
version: 0.1.0
description: Simple echo pipeline to verify Pipelines is working
"""

from typing import List, Union, Generator, Iterator


class Pipeline:
    def __init__(self):
        self.name = "Echo Test"

    async def on_startup(self):
        print(f"Pipeline started: {self.name}")

    async def on_shutdown(self):
        print(f"Pipeline stopped: {self.name}")

    def pipe(
        self,
        user_message: str,
        model_id: str,
        messages: List[dict],
        body: dict,
    ) -> Union[str, Generator, Iterator]:
        return f"[Echo Pipeline] You said: {user_message}"
