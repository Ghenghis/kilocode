"""
Task Ledger (War Room Phase W.2)

A crash-safe, inspectable record of every task the system is working on,
who owns it right now, and how it has moved through the agreed state
machine. This is the backbone the War Room UI renders against, and the
surface the autonomous loop reads and writes to.

Design anchors (from INTERACTIVE_ROADMAP.md §9, §11 and ACTION_PLAN.md §6):
- Every task has a single owner at any time (agent_id). Ownership changes
  go through explicit ``claim``/``handoff`` calls that are journaled.
- Every state transition is validated against the state machine below.
- All events are appended to an in-memory log that can optionally mirror
  to a JSONL file for crash recovery and replay.
- All identifiers that refer to people are ``user_ref`` values from
  ``src.integration.identity`` — never raw identity.

This skeleton intentionally has **no** runtime framework dependency so it
can be imported from CLI tools, Hub routers, tests, and the autonomous
loop alike. A FastAPI adapter will live in ``hub/routers/warroom.py``
(tracked as W1 in the execution plan).

Authoritative plan references:
- OPENCLAUDE_INTEGRATION_PLAN.md §"Definition of Done"
- INTERACTIVE_ROADMAP.md §9 "War Room Architecture", §11 "Autonomous Loop"
- ACTION_PLAN.md §6 "W.2"
"""

from __future__ import annotations

import json
import logging
import secrets
import threading
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------

class TaskState(str, Enum):
    """Canonical task lifecycle."""
    PENDING = "pending"                       # created, not yet claimed
    CLAIMED = "claimed"                       # owned, not yet started
    IN_PROGRESS = "in_progress"               # actively being worked
    BLOCKED = "blocked"                       # waiting on external input
    AWAITING_APPROVAL = "awaiting_approval"   # gated by permission system
    DONE = "done"                             # completed successfully
    FAILED = "failed"                         # terminal error
    CANCELLED = "cancelled"                   # withdrawn by owner/operator


# Allowed transitions. A transition missing here is rejected by the ledger.
_ALLOWED: Dict[TaskState, frozenset] = {
    TaskState.PENDING: frozenset({
        TaskState.CLAIMED, TaskState.CANCELLED,
    }),
    TaskState.CLAIMED: frozenset({
        TaskState.IN_PROGRESS, TaskState.BLOCKED,
        TaskState.AWAITING_APPROVAL, TaskState.CANCELLED,
        TaskState.PENDING,  # release back to the pool
    }),
    TaskState.IN_PROGRESS: frozenset({
        TaskState.BLOCKED, TaskState.AWAITING_APPROVAL,
        TaskState.DONE, TaskState.FAILED, TaskState.CANCELLED,
    }),
    TaskState.BLOCKED: frozenset({
        TaskState.IN_PROGRESS, TaskState.CANCELLED, TaskState.FAILED,
    }),
    TaskState.AWAITING_APPROVAL: frozenset({
        TaskState.IN_PROGRESS, TaskState.CANCELLED, TaskState.FAILED,
    }),
    TaskState.DONE: frozenset(),
    TaskState.FAILED: frozenset(),
    TaskState.CANCELLED: frozenset(),
}


TERMINAL_STATES = frozenset({TaskState.DONE, TaskState.FAILED, TaskState.CANCELLED})


def can_transition(current: TaskState, target: TaskState) -> bool:
    """Return True if ``current -> target`` is a legal transition."""
    return target in _ALLOWED.get(current, frozenset())


class InvalidTransition(ValueError):
    """Raised when a caller requests an illegal state transition."""


class UnknownTask(KeyError):
    """Raised when a task_id is not present in the ledger."""


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class TaskEvent:
    """An append-only event describing something that happened to a task."""
    ts: float
    task_id: str
    kind: str                 # e.g. "created", "claimed", "transitioned", ...
    actor: Optional[str]      # user_ref or agent_id that caused the event
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Task:
    """Single task record."""
    task_id: str
    title: str
    state: TaskState = TaskState.PENDING
    owner_agent: Optional[str] = None             # e.g. "kc-03", None when PENDING
    requester_user_ref: Optional[str] = None      # pseudonymous; never raw identity
    thread_id: Optional[str] = None               # War Room room/thread
    labels: List[str] = field(default_factory=list)
    evidence: List[str] = field(default_factory=list)  # URLs / artifact refs
    approval_request_id: Optional[str] = None     # links to approval_store
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    history: List[TaskEvent] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["state"] = self.state.value
        d["history"] = [
            {**asdict(e), "kind": e.kind} for e in self.history
        ]
        return d


# ---------------------------------------------------------------------------
# Ledger
# ---------------------------------------------------------------------------

EventListener = Callable[[TaskEvent], None]


class TaskLedger:
    """Thread-safe in-memory task ledger with optional JSONL persistence.

    Usage::

        ledger = TaskLedger(persist_path=Path("runtime/task_ledger.jsonl"))
        task_id = ledger.create(title="Prove provider parity", requester_user_ref=ref)
        ledger.claim(task_id, agent="kc-03")
        ledger.transition(task_id, TaskState.IN_PROGRESS, actor="kc-03")
        ledger.attach_evidence(task_id, "https://…/run/42", actor="kc-03")
        ledger.transition(task_id, TaskState.DONE, actor="kc-03")

    Crash recovery: when ``persist_path`` is provided, the ledger replays
    the JSONL event log on construction to rebuild task state. This keeps
    pending approvals and blocked runs visible after a restart, which is
    required by the War Room release-gate acceptance criteria.
    """

    def __init__(self, persist_path: Optional[Path] = None) -> None:
        self._lock = threading.RLock()
        self._tasks: Dict[str, Task] = {}
        self._listeners: List[EventListener] = []
        self._persist_path = persist_path
        self._replaying = False
        if persist_path is not None and persist_path.exists():
            try:
                self._replay()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Could not replay task ledger: %s", exc)

    # ---- listeners --------------------------------------------------------

    def subscribe(self, listener: EventListener) -> None:
        """Register a listener invoked for every new event.

        Listeners run synchronously on the writer's thread. If a listener
        is expensive, it should hand off to its own executor.
        """
        with self._lock:
            self._listeners.append(listener)

    # ---- queries ----------------------------------------------------------

    def get(self, task_id: str) -> Task:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise UnknownTask(task_id)
            return task

    def list(
        self,
        *,
        state: Optional[TaskState] = None,
        owner_agent: Optional[str] = None,
        thread_id: Optional[str] = None,
    ) -> List[Task]:
        """Return tasks filtered by optional criteria."""
        with self._lock:
            items: Iterable[Task] = self._tasks.values()
            if state is not None:
                items = (t for t in items if t.state == state)
            if owner_agent is not None:
                items = (t for t in items if t.owner_agent == owner_agent)
            if thread_id is not None:
                items = (t for t in items if t.thread_id == thread_id)
            return sorted(items, key=lambda t: t.created_at)

    def __len__(self) -> int:
        with self._lock:
            return len(self._tasks)

    # ---- mutators ---------------------------------------------------------

    def create(
        self,
        *,
        title: str,
        requester_user_ref: Optional[str] = None,
        thread_id: Optional[str] = None,
        labels: Optional[List[str]] = None,
        task_id: Optional[str] = None,
    ) -> str:
        """Create a new task in PENDING state. Returns its task_id."""
        if not title.strip():
            raise ValueError("task title must be non-empty")
        with self._lock:
            tid = task_id or self._new_task_id()
            if tid in self._tasks:
                raise ValueError(f"task_id already exists: {tid}")
            task = Task(
                task_id=tid,
                title=title.strip(),
                requester_user_ref=requester_user_ref,
                thread_id=thread_id,
                labels=list(labels or []),
            )
            self._tasks[tid] = task
            self._emit(task, "created", actor=requester_user_ref, details={
                "title": task.title,
                "thread_id": thread_id,
                "labels": list(task.labels),
            })
            return tid

    def claim(self, task_id: str, *, agent: str) -> None:
        """Assign ownership to ``agent`` and move PENDING -> CLAIMED.

        Claiming a task that is already CLAIMED or later requires an
        explicit ``handoff`` instead; this prevents silent ownership steals.
        """
        with self._lock:
            task = self.get(task_id)
            if task.state != TaskState.PENDING:
                raise InvalidTransition(
                    f"cannot claim task in state {task.state.value}; "
                    f"use handoff() to change owner on a running task"
                )
            task.owner_agent = agent
            self._apply_transition(task, TaskState.CLAIMED, actor=agent,
                                   kind="claimed")

    def handoff(self, task_id: str, *, from_agent: str, to_agent: str,
                reason: str = "") -> None:
        """Transfer ownership between two agents on an active task.

        The task must currently be owned by ``from_agent`` and must be in a
        non-terminal state. The state itself is preserved; only the owner
        changes. A ``handoff`` event is journaled.
        """
        if from_agent == to_agent:
            raise ValueError("from_agent and to_agent must differ")
        with self._lock:
            task = self.get(task_id)
            if task.state in TERMINAL_STATES:
                raise InvalidTransition(
                    f"cannot hand off terminal task in state {task.state.value}"
                )
            if task.owner_agent != from_agent:
                raise InvalidTransition(
                    f"task {task_id} is not owned by {from_agent} "
                    f"(current owner: {task.owner_agent})"
                )
            task.owner_agent = to_agent
            task.updated_at = time.time()
            self._emit(task, "handoff", actor=from_agent, details={
                "from_agent": from_agent,
                "to_agent": to_agent,
                "reason": reason,
                "state": task.state.value,
            })

    def transition(self, task_id: str, target: TaskState, *,
                   actor: Optional[str] = None,
                   reason: str = "") -> None:
        """Move a task to ``target`` state if the transition is legal."""
        with self._lock:
            task = self.get(task_id)
            self._apply_transition(task, target, actor=actor,
                                   kind="transitioned", reason=reason)

    def attach_evidence(self, task_id: str, evidence_ref: str, *,
                        actor: Optional[str] = None) -> None:
        """Append an evidence reference (URL or artifact key) to a task."""
        if not evidence_ref.strip():
            raise ValueError("evidence_ref must be non-empty")
        with self._lock:
            task = self.get(task_id)
            task.evidence.append(evidence_ref.strip())
            task.updated_at = time.time()
            self._emit(task, "evidence_added", actor=actor, details={
                "evidence_ref": evidence_ref.strip(),
            })

    def link_approval(self, task_id: str, approval_request_id: str, *,
                      actor: Optional[str] = None) -> None:
        """Link a task to an approval request and move it to AWAITING_APPROVAL."""
        if not approval_request_id.strip():
            raise ValueError("approval_request_id must be non-empty")
        with self._lock:
            task = self.get(task_id)
            task.approval_request_id = approval_request_id.strip()
            self._apply_transition(task, TaskState.AWAITING_APPROVAL,
                                   actor=actor, kind="approval_requested",
                                   details={"approval_request_id":
                                            approval_request_id.strip()})

    # ---- internals --------------------------------------------------------

    def _apply_transition(self, task: Task, target: TaskState, *,
                          actor: Optional[str], kind: str,
                          reason: str = "",
                          details: Optional[Dict[str, Any]] = None) -> None:
        if not can_transition(task.state, target):
            raise InvalidTransition(
                f"illegal transition {task.state.value} -> {target.value} "
                f"for task {task.task_id}"
            )
        prev = task.state
        task.state = target
        task.updated_at = time.time()
        self._emit(
            task, kind, actor=actor,
            details={
                "from": prev.value,
                "to": target.value,
                "reason": reason,
                **(details or {}),
            },
        )

    def _emit(self, task: Task, kind: str, *,
              actor: Optional[str],
              details: Optional[Dict[str, Any]] = None) -> None:
        event = TaskEvent(
            ts=time.time(),
            task_id=task.task_id,
            kind=kind,
            actor=actor,
            details=details or {},
        )
        task.history.append(event)
        if not self._replaying:
            self._persist_event(event, task_snapshot=task)
            for listener in list(self._listeners):
                try:
                    listener(event)
                except Exception:  # pragma: no cover - listener isolation
                    logger.exception("task ledger listener failed")

    def _new_task_id(self) -> str:
        return f"t_{secrets.token_hex(8)}"

    # ---- persistence ------------------------------------------------------

    def _persist_event(self, event: TaskEvent,
                       task_snapshot: Task) -> None:
        if self._persist_path is None:
            return
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            record = {
                "event": {
                    "ts": event.ts,
                    "task_id": event.task_id,
                    "kind": event.kind,
                    "actor": event.actor,
                    "details": event.details,
                },
                "snapshot": {
                    "task_id": task_snapshot.task_id,
                    "title": task_snapshot.title,
                    "state": task_snapshot.state.value,
                    "owner_agent": task_snapshot.owner_agent,
                    "requester_user_ref": task_snapshot.requester_user_ref,
                    "thread_id": task_snapshot.thread_id,
                    "labels": list(task_snapshot.labels),
                    "evidence": list(task_snapshot.evidence),
                    "approval_request_id": task_snapshot.approval_request_id,
                    "created_at": task_snapshot.created_at,
                    "updated_at": task_snapshot.updated_at,
                },
            }
            with self._persist_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, separators=(",", ":")) + "\n")
        except Exception:  # pragma: no cover - defensive
            logger.exception("could not persist task ledger event")

    def _replay(self) -> None:
        assert self._persist_path is not None
        self._replaying = True
        try:
            with self._persist_path.open("r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                    except json.JSONDecodeError:
                        logger.warning("skipping malformed ledger line")
                        continue
                    snap = record.get("snapshot") or {}
                    evt = record.get("event") or {}
                    tid = snap.get("task_id") or evt.get("task_id")
                    if not tid:
                        continue
                    task = self._tasks.get(tid)
                    if task is None:
                        task = Task(
                            task_id=tid,
                            title=snap.get("title", ""),
                            state=TaskState(snap.get("state", TaskState.PENDING.value)),
                            owner_agent=snap.get("owner_agent"),
                            requester_user_ref=snap.get("requester_user_ref"),
                            thread_id=snap.get("thread_id"),
                            labels=list(snap.get("labels", [])),
                            evidence=list(snap.get("evidence", [])),
                            approval_request_id=snap.get("approval_request_id"),
                            created_at=float(snap.get("created_at", time.time())),
                            updated_at=float(snap.get("updated_at", time.time())),
                        )
                        self._tasks[tid] = task
                    else:
                        # Apply snapshot to reflect latest persisted state
                        try:
                            task.state = TaskState(
                                snap.get("state", task.state.value)
                            )
                        except ValueError:
                            pass
                        task.owner_agent = snap.get("owner_agent", task.owner_agent)
                        task.evidence = list(snap.get("evidence", task.evidence))
                        task.approval_request_id = snap.get(
                            "approval_request_id", task.approval_request_id)
                        task.updated_at = float(
                            snap.get("updated_at", task.updated_at))
                    # Re-append the history event but don't re-persist
                    task.history.append(TaskEvent(
                        ts=float(evt.get("ts", time.time())),
                        task_id=tid,
                        kind=str(evt.get("kind", "replayed")),
                        actor=evt.get("actor"),
                        details=dict(evt.get("details", {})),
                    ))
        finally:
            self._replaying = False


__all__ = [
    "TaskState",
    "TaskEvent",
    "Task",
    "TaskLedger",
    "TERMINAL_STATES",
    "can_transition",
    "InvalidTransition",
    "UnknownTask",
]
