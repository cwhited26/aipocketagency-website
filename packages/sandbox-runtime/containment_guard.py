"""containment_guard.py — Python port of the action-path ContainmentGuard (PA-ORCH-9).

A 1:1 port of src/lib/orchestrator/containment-guard.ts. A sub-agent declares its tool scopes
up front; before it stages any connector write, the (connector, action) pair is checked here.
Anything not declared is blocked with a typed error — fail closed, symmetric with the web tier.

Scope grammar (identical to the TS guard):
    "*"           -> every connector + action
    "gmail"       -> every action on gmail (== "gmail:*")
    "gmail:*"     -> every action on gmail
    "gmail:send"  -> only the send action on gmail
"""

from __future__ import annotations

from collections.abc import Iterable


class ConnectorScopeError(Exception):
    """Raised when a connector action is outside a sub-agent's declared scopes."""

    def __init__(self, connector: str, action: str) -> None:
        self.connector = connector
        self.action = action
        self.user_message = (
            f"I tried to {action} via {connector}, but that's outside this run's approved "
            f"scope. Want me to ask for the {connector} scope so I can do that?"
        )
        super().__init__(f"ConnectorScope: {connector}:{action} not in declared scopes")


def _norm(value: str) -> str:
    return value.strip().lower()


def scope_token(connector: str, action: str) -> str:
    """Canonical scope token for a connector action."""
    return f"{_norm(connector)}:{_norm(action)}"


def is_action_allowed(connector: str, action: str, declared_scopes: Iterable[str]) -> bool:
    """True iff connector.action is permitted by the declared scopes. Fail closed."""
    c = _norm(connector)
    a = _norm(action)
    if not c or not a:
        return False
    for raw in declared_scopes:
        scope = _norm(raw)
        if not scope:
            continue
        if scope == "*":
            return True
        if scope == c:
            return True
        if scope == f"{c}:*":
            return True
        if scope == f"{c}:{a}":
            return True
    return False


def assert_action_allowed(connector: str, action: str, declared_scopes: Iterable[str]) -> None:
    """Raise ConnectorScopeError when connector.action is out of scope; else return None."""
    scopes = list(declared_scopes)
    if not is_action_allowed(connector, action, scopes):
        raise ConnectorScopeError(connector, action)
