"""algorithm.py — the pure core of the PA sub-agent runtime (no Modal / no network).

This module holds the typed request/response models (Pydantic) and the 7-phase Algorithm
(PA-ORCH-8) state helpers + the webhook-event builders. Keeping it import-light means pytest
exercises the phase ordering, event shapes, and minute accounting WITHOUT a Modal context or a
live webhook — mirroring how the Node side unit-tests the dispatcher with injected deps.

The webhook events emitted here match src/lib/orchestrator/types.ts WebhookEventSchema exactly
(camelCase keys), so the PA web tier validates them with Zod on arrival.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# ── 7-phase Algorithm (PAI / PA-ORCH-8) ─────────────────────────────────────────────────
PHASES: tuple[str, ...] = (
    "observe",
    "think",
    "plan",
    "build",
    "execute",
    "verify",
    "learn",
)

Phase = Literal["observe", "think", "plan", "build", "execute", "verify", "learn"]


def next_phase(current: str) -> Optional[str]:
    """The phase after `current`, or None when `current` is the last (learn) / unknown."""
    try:
        idx = PHASES.index(current)
    except ValueError:
        return None
    return PHASES[idx + 1] if idx + 1 < len(PHASES) else None


# ── Request models (mirror the TS dispatch payload) ─────────────────────────────────────
class SubAgentSpec(BaseModel):
    objective: str
    tool_scopes: list[str] = Field(default_factory=list)
    read_zones: list[str] = Field(default_factory=list)
    definition_of_done: str = ""
    context: dict[str, Any] = Field(default_factory=dict)


class Callback(BaseModel):
    url: str
    secret: str


class DispatchRequest(BaseModel):
    runId: str
    businessId: str
    spec: SubAgentSpec
    timeBudgetSeconds: int = 300
    brainRepo: Optional[str] = None
    callback: Callback


class CancelRequest(BaseModel):
    runId: str


class ApprovalRequest(BaseModel):
    runId: str
    approvalId: str
    decision: Literal["approved", "rejected"]
    payload: Optional[dict[str, Any]] = None


# ── Webhook event builders (camelCase to match WebhookEventSchema) ──────────────────────
def phase_enter_event(run_id: str, phase: str, note: Optional[str] = None) -> dict[str, Any]:
    event: dict[str, Any] = {"type": "phase_enter", "runId": run_id, "phase": phase}
    if note:
        event["note"] = note
    return event


def phase_complete_event(
    run_id: str, phase: str, duration_ms: int, note: Optional[str] = None
) -> dict[str, Any]:
    event: dict[str, Any] = {
        "type": "phase_complete",
        "runId": run_id,
        "phase": phase,
        "durationMs": max(0, int(duration_ms)),
    }
    if note:
        event["note"] = note
    return event


def action_staged_event(
    run_id: str,
    connector: str,
    action: str,
    payload: dict[str, Any],
    preview: Optional[str] = None,
) -> dict[str, Any]:
    event: dict[str, Any] = {
        "type": "action_staged",
        "runId": run_id,
        "connector": connector,
        "action": action,
        "payload": payload,
    }
    if preview:
        event["preview"] = preview
    return event


def run_complete_event(
    run_id: str,
    status: Literal["done", "failed", "canceled"],
    agent_minutes: float,
    result_summary: Optional[str] = None,
    token_cost: Optional[int] = None,
) -> dict[str, Any]:
    event: dict[str, Any] = {
        "type": "run_complete",
        "runId": run_id,
        "status": status,
        "agentMinutes": max(0.0, float(agent_minutes)),
    }
    if result_summary:
        event["resultSummary"] = result_summary
    if token_cost is not None:
        event["tokenCost"] = max(0, int(token_cost))
    return event


def estimate_agent_minutes(elapsed_seconds: float) -> float:
    """Measured agent-minutes from wall-clock seconds, floored at 0.1 and rounded to a tenth."""
    return max(0.1, round(elapsed_seconds / 60 * 10) / 10)
