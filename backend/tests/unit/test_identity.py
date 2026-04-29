"""Unit tests for src.integration.identity (War Room W.1)."""

from __future__ import annotations

import pytest

from backend.integration.identity import (
    IdentityMapping,
    derive_user_ref,
    new_session_id,
    new_thread_id,
    rotate_salt,
)


class TestDerivations:
    def test_user_ref_is_prefixed_and_versioned(self) -> None:
        ref = derive_user_ref("alice@example.com")
        assert ref.startswith("u_v1_")
        assert len(ref) >= len("u_v1_") + 16  # 24 hex chars

    def test_user_ref_is_stable_for_same_identity(self) -> None:
        a = derive_user_ref("alice@example.com")
        b = derive_user_ref("alice@example.com")
        assert a == b

    def test_user_ref_differs_per_identity(self) -> None:
        assert derive_user_ref("alice@example.com") != derive_user_ref("bob@example.com")

    def test_user_ref_changes_after_salt_rotation(self) -> None:
        before = derive_user_ref("alice@example.com")
        rotate_salt(b"a-new-salt-with-different-bytes-32")
        try:
            after = derive_user_ref("alice@example.com")
            assert before != after, "salt rotation must invalidate pseudonyms"
        finally:
            # Leave the next test a fresh, random salt.
            rotate_salt()

    def test_empty_identity_rejected(self) -> None:
        with pytest.raises(ValueError):
            derive_user_ref("")

    def test_thread_and_session_ids_are_unique_and_prefixed(self) -> None:
        ts = {new_thread_id() for _ in range(50)}
        ss = {new_session_id() for _ in range(50)}
        assert len(ts) == 50
        assert len(ss) == 50
        assert all(t.startswith("th_") for t in ts)
        assert all(s.startswith("s_") for s in ss)


class TestIdentityMapping:
    def test_register_is_idempotent(self) -> None:
        m = IdentityMapping()
        a = m.register("alice@example.com", display_name="Alice")
        b = m.register("alice@example.com")
        assert a == b
        assert len(m) == 1

    def test_resolve_to_ref_returns_none_for_unknown(self) -> None:
        m = IdentityMapping()
        assert m.resolve_to_ref("ghost@example.com") is None

    def test_public_api_has_no_ref_to_identity_reverse_lookup(self) -> None:
        """The class must not expose a method returning real identity from user_ref.

        This is a deliberate invariant: reversing the pseudonym MUST require
        direct access to the (secret) mapping store, not a public API.
        """
        m = IdentityMapping()
        public = {name for name in dir(m) if not name.startswith("_")}
        forbidden = {"reveal", "real_identity_for", "lookup_identity", "resolve_identity"}
        assert not (public & forbidden), (
            f"IdentityMapping must not expose a reverse-lookup method; "
            f"found: {public & forbidden}"
        )

    def test_attrs_for_ref_returns_only_non_identifying_attrs(self) -> None:
        m = IdentityMapping()
        ref = m.register("alice@example.com", display_name="Alice", team="A")
        attrs = m.attrs_for_ref(ref)
        assert attrs == {"display_name": "Alice", "team": "A"}
        # real identity must not be anywhere in the returned attrs
        assert "alice@example.com" not in str(attrs)

    def test_forget_removes_mapping(self) -> None:
        m = IdentityMapping()
        m.register("alice@example.com")
        assert m.forget("alice@example.com") is True
        assert len(m) == 0
        assert m.resolve_to_ref("alice@example.com") is None
        # second call is a no-op
        assert m.forget("alice@example.com") is False

    def test_persistence_round_trip(self, tmp_path) -> None:
        path = tmp_path / "identity.json"
        m1 = IdentityMapping(persist_path=path)
        ref = m1.register("alice@example.com", display_name="Alice")
        assert path.exists()

        m2 = IdentityMapping(persist_path=path)
        assert m2.resolve_to_ref("alice@example.com") == ref
        assert m2.attrs_for_ref(ref) == {"display_name": "Alice"}
