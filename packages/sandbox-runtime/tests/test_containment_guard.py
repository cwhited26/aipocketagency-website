"""Unit tests for the Python action-path ContainmentGuard (parity with the TS guard)."""

from __future__ import annotations

import pytest

from containment_guard import (
    ConnectorScopeError,
    assert_action_allowed,
    is_action_allowed,
    scope_token,
)


def test_scope_token_normalizes() -> None:
    assert scope_token("Gmail", "Send") == "gmail:send"


def test_exact_scope_allows() -> None:
    assert is_action_allowed("gmail", "send", ["gmail:send"]) is True


def test_connector_wildcard_allows() -> None:
    assert is_action_allowed("gmail", "send", ["gmail"]) is True
    assert is_action_allowed("gmail", "archive", ["gmail:*"]) is True


def test_global_wildcard_allows() -> None:
    assert is_action_allowed("stripe", "refund", ["*"]) is True


def test_case_insensitive() -> None:
    assert is_action_allowed("Gmail", "SEND", ["gmail:send"]) is True


def test_fails_closed() -> None:
    assert is_action_allowed("stripe", "refund", ["gmail:send", "slack"]) is False
    assert is_action_allowed("gmail", "delete", ["gmail:send"]) is False
    assert is_action_allowed("gmail", "send", []) is False
    assert is_action_allowed("", "send", ["*"]) is False
    assert is_action_allowed("gmail", "", ["*"]) is False


def test_assert_raises_typed_error() -> None:
    assert_action_allowed("gmail", "send", ["gmail"])  # no raise
    with pytest.raises(ConnectorScopeError) as exc:
        assert_action_allowed("stripe", "refund", ["gmail:send"])
    assert exc.value.connector == "stripe"
    assert exc.value.action == "refund"
    assert "approved" in exc.value.user_message
