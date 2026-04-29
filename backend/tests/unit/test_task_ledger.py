"""Unit tests for src.integration.task_ledger (War Room W.2)."""

from __future__ import annotations

import pytest

from backend.integration.task_ledger import (
    InvalidTransition,
    Task,
    TaskLedger,
    TaskState,
    UnknownTask,
    can_transition,
)


class TestStateMachine:
    @pytest.mark.parametrize("src,dst,allowed", [
        (TaskState.PENDING,           TaskState.CLAIMED,           True),
        (TaskState.PENDING,           TaskState.IN_PROGRESS,       False),
        (TaskState.CLAIMED,           TaskState.IN_PROGRESS,       True),
        (TaskState.CLAIMED,           TaskState.PENDING,           True),
        (TaskState.IN_PROGRESS,       TaskState.DONE,              True),
        (TaskState.IN_PROGRESS,       TaskState.AWAITING_APPROVAL, True),
        (TaskState.AWAITING_APPROVAL, TaskState.IN_PROGRESS,       True),
        (TaskState.DONE,              TaskState.IN_PROGRESS,       False),
        (TaskState.FAILED,            TaskState.IN_PROGRESS,       False),
        (TaskState.CANCELLED,         TaskState.PENDING,           False),
    ])
    def test_can_transition(self, src, dst, allowed) -> None:
        assert can_transition(src, dst) is allowed


class TestLedgerCore:
    def test_create_returns_task_id_and_persists_record(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="Prove provider parity",
                            requester_user_ref="u_v1_ref123")
        task = ledger.get(tid)
        assert isinstance(task, Task)
        assert task.state == TaskState.PENDING
        assert task.title == "Prove provider parity"
        assert task.requester_user_ref == "u_v1_ref123"
        assert task.owner_agent is None

    def test_create_requires_non_empty_title(self) -> None:
        ledger = TaskLedger()
        with pytest.raises(ValueError):
            ledger.create(title="   ")

    def test_get_unknown_raises(self) -> None:
        ledger = TaskLedger()
        with pytest.raises(UnknownTask):
            ledger.get("does-not-exist")

    def test_claim_moves_to_claimed_and_sets_owner(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        ledger.claim(tid, agent="kc-03")
        t = ledger.get(tid)
        assert t.state == TaskState.CLAIMED
        assert t.owner_agent == "kc-03"

    def test_cannot_claim_non_pending(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        ledger.claim(tid, agent="kc-03")
        with pytest.raises(InvalidTransition):
            ledger.claim(tid, agent="kc-04")

    def test_handoff_requires_current_owner(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        ledger.claim(tid, agent="kc-03")
        ledger.transition(tid, TaskState.IN_PROGRESS, actor="kc-03")

        with pytest.raises(InvalidTransition):
            ledger.handoff(tid, from_agent="kc-99", to_agent="kc-04")

        ledger.handoff(tid, from_agent="kc-03", to_agent="kc-04",
                       reason="rebalance")
        assert ledger.get(tid).owner_agent == "kc-04"
        # State should be preserved across handoff
        assert ledger.get(tid).state == TaskState.IN_PROGRESS

    def test_handoff_rejected_on_terminal_state(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        ledger.claim(tid, agent="kc-03")
        ledger.transition(tid, TaskState.IN_PROGRESS, actor="kc-03")
        ledger.transition(tid, TaskState.DONE, actor="kc-03")
        with pytest.raises(InvalidTransition):
            ledger.handoff(tid, from_agent="kc-03", to_agent="kc-04")

    def test_transition_rejects_illegal_move(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        with pytest.raises(InvalidTransition):
            ledger.transition(tid, TaskState.DONE)  # PENDING -> DONE is illegal

    def test_attach_evidence_appends(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        ledger.attach_evidence(tid, "https://example/run/1", actor="kc-03")
        ledger.attach_evidence(tid, "artifact://run-1.log", actor="kc-03")
        assert ledger.get(tid).evidence == [
            "https://example/run/1",
            "artifact://run-1.log",
        ]

    def test_link_approval_moves_to_awaiting(self) -> None:
        ledger = TaskLedger()
        tid = ledger.create(title="t")
        ledger.claim(tid, agent="kc-03")
        ledger.transition(tid, TaskState.IN_PROGRESS, actor="kc-03")
        ledger.link_approval(tid, "ap_abc", actor="kc-03")
        t = ledger.get(tid)
        assert t.state == TaskState.AWAITING_APPROVAL
        assert t.approval_request_id == "ap_abc"


class TestLedgerQueries:
    def test_list_filters(self) -> None:
        ledger = TaskLedger()
        a = ledger.create(title="a", thread_id="th_1")
        b = ledger.create(title="b", thread_id="th_1")
        c = ledger.create(title="c", thread_id="th_2")
        ledger.claim(a, agent="kc-03")
        ledger.claim(c, agent="kc-07")

        assert {t.task_id for t in ledger.list(state=TaskState.PENDING)} == {b}
        assert {t.task_id for t in ledger.list(state=TaskState.CLAIMED)} == {a, c}
        assert {t.task_id for t in ledger.list(owner_agent="kc-03")} == {a}
        assert {t.task_id for t in ledger.list(thread_id="th_1")} == {a, b}


class TestListeners:
    def test_listener_receives_events(self) -> None:
        ledger = TaskLedger()
        events: list = []
        ledger.subscribe(lambda e: events.append(e))
        tid = ledger.create(title="t")
        ledger.claim(tid, agent="kc-03")
        ledger.transition(tid, TaskState.IN_PROGRESS, actor="kc-03")
        kinds = [e.kind for e in events]
        assert kinds == ["created", "claimed", "transitioned"]


class TestPersistenceAndReplay:
    def test_crash_recovery_replays_state(self, tmp_path) -> None:
        path = tmp_path / "ledger.jsonl"

        ledger1 = TaskLedger(persist_path=path)
        tid = ledger1.create(title="durable task",
                             requester_user_ref="u_v1_xyz")
        ledger1.claim(tid, agent="kc-03")
        ledger1.transition(tid, TaskState.IN_PROGRESS, actor="kc-03")
        ledger1.attach_evidence(tid, "https://example/r/1", actor="kc-03")
        ledger1.link_approval(tid, "ap_42", actor="kc-03")

        # Simulate crash & restart: drop ledger1, construct a new one on same path.
        ledger2 = TaskLedger(persist_path=path)
        assert len(ledger2) == 1
        t = ledger2.get(tid)
        assert t.state == TaskState.AWAITING_APPROVAL
        assert t.owner_agent == "kc-03"
        assert t.approval_request_id == "ap_42"
        assert t.evidence == ["https://example/r/1"]
        assert t.requester_user_ref == "u_v1_xyz"
        # History should contain all journaled events
        kinds = [e.kind for e in t.history]
        assert "created" in kinds and "claimed" in kinds
        assert "evidence_added" in kinds and "approval_requested" in kinds

    def test_replay_does_not_double_emit_to_listeners(self, tmp_path) -> None:
        path = tmp_path / "ledger.jsonl"
        ledger1 = TaskLedger(persist_path=path)
        tid = ledger1.create(title="t")
        ledger1.claim(tid, agent="kc-03")

        fresh_events: list = []
        ledger2 = TaskLedger(persist_path=path)
        ledger2.subscribe(lambda e: fresh_events.append(e))
        # No mutations after construction → listeners must not see any replay noise.
        assert fresh_events == []
