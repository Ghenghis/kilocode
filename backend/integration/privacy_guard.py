"""War Room W.4 — Privacy Guard for redaction before SSE/telemetry export.

Provides privacy-safe telemetry export by redacting or pseudonymizing sensitive data.
Ensures compliance with privacy requirements for the War Room collaboration surface.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Pattern, Set


class PrivacyGuard:
    """Privacy guard for redacting sensitive information.
    
    Features:
    - Pattern-based redaction for common sensitive data (API keys, emails, etc.)
    - Pseudonymization for user identifiers
    - Configurable redaction levels
    - Audit logging of redaction operations
    """
    
    # Default patterns for sensitive data detection
    DEFAULT_PATTERNS: Dict[str, Pattern] = {
        "api_key": re.compile(r"(?:api[_-]?key|apikey|key)[\"']?\s*[:=]\s*[\"']?([a-zA-Z0-9_\-]{16,})[\"']?", re.IGNORECASE),
        "bearer_token": re.compile(r"Bearer\s+([a-zA-Z0-9_\-\.]{20,})", re.IGNORECASE),
        "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
        "ip_address": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
        "password": re.compile(r"(?:password|passwd|pwd)[\"']?\s*[:=]\s*[\"']?([^\"'\s]+)[\"']?", re.IGNORECASE),
        "secret": re.compile(r"(?:secret)[\"']?\s*[:=]\s*[\"']?([a-zA-Z0-9_\-]{8,})[\"']?", re.IGNORECASE),
        "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
        "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "private_key": re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----"),
    }
    
    def __init__(
        self,
        salt: Optional[str] = None,
        redaction_char: str = "*",
        pseudonymize_identifiers: bool = True,
        custom_patterns: Optional[Dict[str, Pattern]] = None,
    ):
        self._salt = salt or "warroom-default-salt-change-in-prod"
        self._redaction_char = redaction_char
        self._pseudonymize = pseudonymize_identifiers
        self._patterns = {**self.DEFAULT_PATTERNS, **(custom_patterns or {})}
        self._redaction_log: List[Dict[str, Any]] = []
    
    def redact_string(self, text: str, preserve_length: bool = True) -> str:
        """Redact sensitive patterns from a string."""
        if not text:
            return text
        
        result = text
        redactions = []
        
        for pattern_name, pattern in self._patterns.items():
            for match in pattern.finditer(text):
                matched_text = match.group(0)
                # Create redacted version
                if preserve_length:
                    redacted = self._redaction_char * len(matched_text)
                else:
                    redacted = f"[{pattern_name}_REDACTED]"
                
                result = result.replace(matched_text, redacted, 1)
                redactions.append({
                    "pattern": pattern_name,
                    "position": match.start(),
                    "length": len(matched_text),
                })
        
        if redactions:
            self._redaction_log.append({
                "type": "string",
                "redactions": redactions,
            })
        
        return result
    
    def redact_dict(
        self,
        data: Dict[str, Any],
        sensitive_keys: Optional[Set[str]] = None,
        preserve_structure: bool = True,
    ) -> Dict[str, Any]:
        """Redact sensitive data from a dictionary."""
        if sensitive_keys is None:
            sensitive_keys = {
                "api_key", "apikey", "key", "token", "password", "secret",
                "auth", "authorization", "credential", "private_key", "email",
            }
        
        result: Dict[str, Any] = {}
        redactions = []
        
        for key, value in data.items():
            key_lower = key.lower()
            
            if key_lower in sensitive_keys:
                # Redact the entire value
                if isinstance(value, str):
                    redacted = self._redaction_char * len(value) if len(value) < 50 else f"[{key}_REDACTED]"
                    result[key] = redacted
                    redactions.append({"key": key, "action": "redacted"})
                else:
                    result[key] = "[REDACTED]"
                    redactions.append({"key": key, "action": "redacted"})
            
            elif isinstance(value, str):
                # Check for embedded sensitive data
                redacted_value = self.redact_string(value)
                result[key] = redacted_value
                if redacted_value != value:
                    redactions.append({"key": key, "action": "partial_redact"})
            
            elif isinstance(value, dict):
                # Recursively redact nested dicts
                result[key] = self.redact_dict(value, sensitive_keys, preserve_structure)
            
            elif isinstance(value, list):
                # Process list items
                result[key] = [
                    self.redact_dict(item, sensitive_keys, preserve_structure) if isinstance(item, dict)
                    else self.redact_string(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            
            else:
                result[key] = value
        
        if redactions:
            self._redaction_log.append({
                "type": "dict",
                "redactions": redactions,
            })
        
        return result
    
    def pseudonymize(self, identifier: str) -> str:
        """Create a pseudonym for an identifier.
        
        Uses HMAC with salt to create a stable but non-reversible mapping.
        """
        if not identifier:
            return identifier
        
        # Create hash-based pseudonym
        h = hashlib.sha256(f"{self._salt}:{identifier}".encode()).hexdigest()[:16]
        return f"anon-{h}"
    
    def prepare_for_export(
        self,
        data: Dict[str, Any],
        export_context: str = "telemetry",
    ) -> Dict[str, Any]:
        """Prepare data for privacy-safe export.
        
        This is the main entry point for War Room telemetry export.
        """
        # First, redact sensitive fields
        redacted = self.redact_dict(data)
        
        # Then pseudonymize identifiers if enabled
        if self._pseudonymize:
            identifier_fields = ["user_id", "user_ref", "session_id", "agent_id", "requester_id"]
            for field in identifier_fields:
                if field in redacted and isinstance(redacted[field], str):
                    if not redacted[field].startswith("anon-"):
                        redacted[field] = self.pseudonymize(redacted[field])
        
        # Add export metadata
        redacted["_privacy_meta"] = {
            "export_context": export_context,
            "redacted": True,
            "version": "2.0",
        }
        
        return redacted
    
    def prepare_sse_event(
        self,
        event_type: str,
        event_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Prepare an SSE event for privacy-safe broadcast.
        
        Used by event_bus to ensure all SSE events are privacy-compliant.
        """
        return {
            "type": event_type,
            "data": self.prepare_for_export(event_data, export_context="sse"),
            "ts": event_data.get("ts"),
        }
    
    def get_redaction_stats(self) -> Dict[str, Any]:
        """Get statistics about redaction operations."""
        return {
            "total_operations": len(self._redaction_log),
            "patterns_available": list(self._patterns.keys()),
            "pseudonymization_enabled": self._pseudonymize,
        }
    
    def clear_log(self) -> None:
        """Clear the redaction log (for memory management)."""
        self._redaction_log.clear()


# Global singleton instance
_default_guard: Optional[PrivacyGuard] = None


def get_guard(
    salt: Optional[str] = None,
    pseudonymize: bool = True,
) -> PrivacyGuard:
    """Get the default privacy guard singleton."""
    global _default_guard
    if _default_guard is None:
        _default_guard = PrivacyGuard(
            salt=salt,
            pseudonymize_identifiers=pseudonymize,
        )
    return _default_guard


def redact_for_export(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to redact data using default guard."""
    return get_guard().prepare_for_export(data)


def pseudonymize_id(identifier: str) -> str:
    """Convenience function to pseudonymize an identifier."""
    return get_guard().pseudonymize(identifier)
