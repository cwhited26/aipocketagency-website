"""Unit tests for the pure runtime core (no Modal, no network)."""

from __future__ import annotations

from algorithm import (
    PHASES,
    DispatchRequest,
    estimate_agent_minutes,
    next_phase,
    phase_complete_event,
    phase_enter_event,
    action_staged_event,
    run_complete_event,
)


def test_phase_order_is_the_seven_phase_algorithm() -> None:
    assert PHASES == ("observe", "think", "plan", "build", "execute", "verify", "learn")


def test_next_phase_walks_then_terminates() -> None:
    assert next_phase("observe") == "think"
    assert next_phase("execute") == "verify"
    assert next_phase("learn") is None
    assert next_phase("bogus") is None


def test_phase_enter_event_shape() -> None:
    e = phase_enter_event("run-1", "observe")
    assert e == {"type": "phase_enter", "runId": "run-1", "phase": "observe"}
    assert phase_enter_event("run-1", "think", "note")["note"] == "note"


def test_phase_complete_clamps_duration() -> None:
    e = phase_complete_event("run-1", "build", -5)
    assert e["durationMs"] == 0
    assert e["type"] == "phase_complete"


def test_action_staged_event_shape() -> None:
    e = action_staged_event("run-1", "gmail", "send", {"to": "x@y.com"}, "Email Patrick")
    assert e["type"] == "action_staged"
    assert e["connector"] == "gmail"
    assert e["action"] == "send"
    assert e["payload"] == {"to": "x@y.com"}
    assert e["preview"] == "Email Patrick"


def test_run_complete_event_shape_and_clamps() -> None:
    e = run_complete_event("run-1", "done", 12.5, "all good", 1000)
    assert e["status"] == "done"
    assert e["agentMinutes"] == 12.5
    assert e["resultSummary"] == "all good"
    assert e["tokenCost"] == 1000
    # negative minutes clamp to 0
    assert run_complete_event("run-1", "failed", -3)["agentMinutes"] == 0.0


def test_estimate_agent_minutes_floor_and_rounding() -> None:
    assert estimate_agent_minutes(600) == 10.0
    assert estimate_agent_minutes(0) == 0.1  # floors
    assert estimate_agent_minutes(90) == 1.5


def test_dispatch_request_parses_camelcase_payload() -> None:
    req = DispatchRequest.model_validate(
        {
            "runId": "run-1",
            "businessId": "biz-1",
            "spec": {
                "objective": "do the thing",
                "tool_scopes": ["gmail"],
                "read_zones": ["project-shared"],
                "definition_of_done": "thing done",
                "context": {"scaffold": {"milestones": []}},
            },
            "timeBudgetSeconds": 300,
            "brainRepo": "owner/brain",
            "callback": {"url": "https://pa/api/orchestrator/webhook", "secret": "s"},
        }
    )
    assert req.runId == "run-1"
    assert req.spec.tool_scopes == ["gmail"]
    assert req.callback.secret == "s"
