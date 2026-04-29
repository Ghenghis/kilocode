"""War Room W.3 — Durable Approval Store for pending approvals with request_id + timeout.

Provides persistent storage for approval requests that survive disconnects and restarts.
Integrates with the task_ledger for full audit trail.
"""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable


@dataclass
class ApprovalRequest:
    """A durable approval request."""
    request_id: str
    requester_id: str  # Agent or user requesting
    requester_type: str  # "agent", "user", "system"
    action_type: str  # e.g., "capability_invoke", "task_execute", "settings_change"
    action_params: Dict[str, Any]
    resource_id: str  # What is being acted upon
    risk_level: str  # "low", "medium", "high", "critical"
    requested_at: float
    timeout_seconds: int
    resolved: bool = False
    resolved_at: Optional[float] = None
    resolution: Optional[str] = None  # "approved", "denied", "timeout", "cancelled"
    resolver_id: Optional[str] = None
    reason: Optional[str] = None
    
    def is_expired(self) -> bool:
        """Check if approval request has timed out."""
        if self.resolved:
            return False
        return time.time() > self.requested_at + self.timeout_seconds
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ApprovalRequest:
        return cls(**d)


class ApprovalStore:
    """Durable store for approval requests with JSONL persistence.
    
    Features:
    - Persistent storage across restarts
    - Timeout handling for expired requests
    - Event callbacks for state changes
    - Integration with task ledger
    """
    
    def __init__(
        self,
        journal_path: Optional[Path] = None,
        default_timeout: int = 300,
    ):
        self._requests: Dict[str, ApprovalRequest] = {}
        self._callbacks: List[Callable[[str, ApprovalRequest], None]] = []
        self._default_timeout = default_timeout
        
        if journal_path is None:
            journal_path = Path("data/approvals.jsonl")
        self._journal_path = journal_path
        self._journal_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._load_journal()
    
    def create_request(
        self,
        requester_id: str,
        requester_type: str,
        action_type: str,
        action_params: Dict[str, Any],
        resource_id: str,
        risk_level: str = "medium",
        timeout_seconds: Optional[int] = None,
        custom_request_id: Optional[str] = None,
    ) -> str:
        """Create a new approval request.
        
        Returns:
            request_id: The unique ID for this approval request
        """
        request_id = custom_request_id or f"req-{uuid.uuid4().hex[:12]}"
        
        req = ApprovalRequest(
            request_id=request_id,
            requester_id=requester_id,
            requester_type=requester_type,
            action_type=action_type,
            action_params=action_params,
            resource_id=resource_id,
            risk_level=risk_level,
            requested_at=time.time(),
            timeout_seconds=timeout_seconds or self._default_timeout,
        )
        
        self._requests[request_id] = req
        self._append_to_journal(req)
        self._notify("created", req)
        
        return request_id
    
    def get_request(self, request_id: str) -> Optional[ApprovalRequest]:
        """Get an approval request by ID."""
        req = self._requests.get(request_id)
        if req and not req.resolved and req.is_expired():
            # Auto-expire
            self.resolve_request(request_id, "timeout", "system", "Request timed out")
            req = self._requests.get(request_id)
        return req
    
    def list_pending(
        self,
        requester_id: Optional[str] = None,
        risk_level: Optional[str] = None,
    ) -> List[ApprovalRequest]:
        """List pending (unresolved) approval requests."""
        results = []
        for req in self._requests.values():
            if req.resolved:
                continue
            if req.is_expired():
                self.resolve_request(req.request_id, "timeout", "system", "Request timed out")
                continue
            if requester_id and req.requester_id != requester_id:
                continue
            if risk_level and req.risk_level != risk_level:
                continue
            results.append(req)
        return results
    
    def resolve_request(
        self,
        request_id: str,
        resolution: str,  # "approved", "denied", "timeout", "cancelled"
        resolver_id: str,
        reason: Optional[str] = None,
    ) -> bool:
        """Resolve an approval request.
        
        Returns:
            bool: True if resolved, False if not found or already resolved
        """
        req = self._requests.get(request_id)
        if not req:
            return False
        if req.resolved:
            return False
        
        req.resolved = True
        req.resolved_at = time.time()
        req.resolution = resolution
        req.resolver_id = resolver_id
        req.reason = reason
        
        self._append_to_journal(req)
        self._notify("resolved", req)
        
        return True
    
    def on_change(self, callback: Callable[[str, ApprovalRequest], None]) -> None:
        """Register a callback for approval state changes.
        
        Callback receives (event_type, approval_request).
        Event types: "created", "resolved"
        """
        self._callbacks.append(callback)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about approval requests."""
        total = len(self._requests)
        pending = sum(1 for r in self._requests.values() if not r.resolved)
        approved = sum(1 for r in self._requests.values() if r.resolution == "approved")
        denied = sum(1 for r in self._requests.values() if r.resolution == "denied")
        timed_out = sum(1 for r in self._requests.values() if r.resolution == "timeout")
        
        by_risk = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for r in self._requests.values():
            if r.risk_level in by_risk:
                by_risk[r.risk_level] += 1
        
        return {
            "total": total,
            "pending": pending,
            "approved": approved,
            "denied": denied,
            "timed_out": timed_out,
            "by_risk": by_risk,
        }
    
    def _notify(self, event: str, req: ApprovalRequest) -> None:
        """Notify all registered callbacks."""
        for cb in self._callbacks:
            try:
                cb(event, req)
            except Exception:
                pass
    
    def _append_to_journal(self, req: ApprovalRequest) -> None:
        """Append request to JSONL journal."""
        try:
            with open(self._journal_path, "a") as f:
                f.write(json.dumps(req.to_dict(), separators=(",", ":")) + "\n")
        except Exception:
            pass
    
    def _load_journal(self) -> None:
        """Load requests from JSONL journal."""
        if not self._journal_path.exists():
            return
        
        try:
            with open(self._journal_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        req = ApprovalRequest.from_dict(data)
                        # Keep the latest state for each request_id
                        self._requests[req.request_id] = req
                    except Exception:
                        continue
        except Exception:
            pass


# Global singleton instance
_default_store: Optional[ApprovalStore] = None


def get_store(journal_path: Optional[Path] = None) -> ApprovalStore:
    """Get the default approval store singleton."""
    global _default_store
    if _default_store is None:
        _default_store = ApprovalStore(journal_path=journal_path)
    return _default_store
