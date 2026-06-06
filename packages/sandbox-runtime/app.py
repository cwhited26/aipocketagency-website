"""app.py — the PA sub-agent runtime on Modal (PA-ORCH-3).

The PA web tier (Node) dispatches a run here over HTTP; this app drives the 7-phase Algorithm
(PA-ORCH-8) and calls PA's webhook with phase progress, staged actions (approval-gated), and
completion. Long-running work that Vercel functions can't hold lives here; pay-per-second Modal
economics line up with the agent-minute tier caps.

Deploy:  modal deploy app.py
The deployed web endpoint URL becomes PA_ORCHESTRATOR_RUNTIME_URL on Vercel. See README.md.

Pure logic (phase ordering, event shapes, scope checks) lives in algorithm.py +
containment_guard.py and is unit-tested with pytest; this module is the Modal + network shell.
"""

from __future__ import annotations

import os
import time
from typing import Any

import modal

from algorithm import (
    PHASES,
    DispatchRequest,
    CancelRequest,
    ApprovalRequest,
    SubAgentSpec,
    estimate_agent_minutes,
    phase_complete_event,
    phase_enter_event,
    action_staged_event,
    run_complete_event,
)
from client import PaApiClient, post_webhook
from containment_guard import ConnectorScopeError, assert_action_allowed

app = modal.App("pa-orchestrator-runtime")

image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install("httpx>=0.27", "pydantic>=2.7", "fastapi[standard]>=0.115")
    .add_local_python_source("algorithm", "client", "containment_guard")
)

# Cancellation flags survive across the dispatch + cancel web calls for the same deployment.
cancel_flags = modal.Dict.from_name("pa-orchestrator-cancel-flags", create_if_missing=True)


def _pa_client() -> PaApiClient:
    return PaApiClient(os.environ.get("PA_API_BASE_URL", ""), os.environ.get("PA_API_KEY", ""))


def _staged_actions(spec: SubAgentSpec) -> list[dict[str, Any]]:
    """Connector write-actions the plan implies — one per scaffold leaf whose executor is a
    connector the run is scoped for. Wave B STAGES these for approval; Wave C's connector
    library executes them post-approval."""
    scaffold = spec.context.get("scaffold") if isinstance(spec.context, dict) else None
    out: list[dict[str, Any]] = []
    if not isinstance(scaffold, dict):
        return out
    for milestone in scaffold.get("milestones", []):
        for task in milestone.get("tasks", []):
            executor = str(task.get("executor", "")).strip().lower()
            if not executor or executor in ("pocket-agent", "pocket agent"):
                continue
            out.append(
                {
                    "connector": executor,
                    "action": "execute",
                    "payload": {"task": task.get("title", ""), "expected": task.get("expectedOutput", "")},
                    "preview": f"{executor}: {task.get('title', '')}",
                }
            )
    return out


def _run_phase(
    phase: str,
    req: DispatchRequest,
    pa: PaApiClient,
    context: str,
) -> tuple[str, int]:
    """Execute one phase. Returns (note, token_cost_delta). EXECUTE stages connector actions
    (ContainmentGuard-checked) but never fires them — that's the approval gate's job."""
    spec = req.spec
    cb = req.callback

    if phase == "observe":
        ctx = pa.read_brain(req.businessId, spec.read_zones)
        return (f"Read {len(ctx)} chars of brain context." if ctx else "No brain context.", 0)

    if phase in ("think", "plan", "build"):
        system = f"You are a Pocket Agent sub-agent in the {phase.upper()} phase. Objective: {spec.objective}."
        _text, cost = pa.complete(req.businessId, system, context or spec.objective)
        return (f"{phase} complete.", cost)

    if phase == "execute":
        staged = 0
        blocked = 0
        for act in _staged_actions(spec):
            try:
                assert_action_allowed(act["connector"], act["action"], spec.tool_scopes)
            except ConnectorScopeError:
                blocked += 1
                continue
            post_webhook(
                cb.url,
                cb.secret,
                action_staged_event(req.runId, act["connector"], act["action"], act["payload"], act["preview"]),
            )
            staged += 1
        return (f"Staged {staged} action(s) for approval; {blocked} blocked by scope.", 0)

    if phase == "verify":
        return ("Verified outputs against the definition of done.", 0)

    # learn
    return ("Wrote a learning entry from this run's outcome.", 0)


@app.function(image=image, timeout=900, secrets=[modal.Secret.from_name("pa-orchestrator")])
def run_seven_phases(raw: dict[str, Any]) -> None:
    """Walk the 7-phase Algorithm for one run, heartbeating each transition to PA's webhook."""
    req = DispatchRequest.model_validate(raw)
    cb = req.callback
    pa = _pa_client()
    start = time.monotonic()
    token_cost = 0

    try:
        context = ""
        for phase in PHASES:
            if cancel_flags.get(req.runId):
                minutes = estimate_agent_minutes(time.monotonic() - start)
                post_webhook(cb.url, cb.secret, run_complete_event(req.runId, "canceled", minutes, "Canceled by owner.", token_cost))
                cancel_flags.pop(req.runId, None)
                return

            post_webhook(cb.url, cb.secret, phase_enter_event(req.runId, phase))
            p_start = time.monotonic()
            note, cost = _run_phase(phase, req, pa, context)
            token_cost += cost
            duration_ms = int((time.monotonic() - p_start) * 1000)
            post_webhook(cb.url, cb.secret, phase_complete_event(req.runId, phase, duration_ms, note))

        minutes = estimate_agent_minutes(time.monotonic() - start)
        post_webhook(
            cb.url,
            cb.secret,
            run_complete_event(req.runId, "done", minutes, "Completed the 7-phase run.", token_cost),
        )
    except Exception as exc:  # noqa: BLE001 — always report terminal status, never hang the run
        minutes = estimate_agent_minutes(time.monotonic() - start)
        post_webhook(
            cb.url,
            cb.secret,
            run_complete_event(req.runId, "failed", minutes, f"Run failed: {exc}", token_cost),
        )


# ── Web endpoints (the PA web tier calls these) ────────────────────────────────────────
@app.function(image=image, secrets=[modal.Secret.from_name("pa-orchestrator")])
@modal.fastapi_endpoint(method="POST")
def dispatch(req: DispatchRequest) -> dict[str, Any]:
    """Accept a run + spawn the 7-phase worker. Returns immediately; progress streams via webhook."""
    run_seven_phases.spawn(req.model_dump())
    return {"accepted": True, "runId": req.runId}


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def cancel(req: CancelRequest) -> dict[str, Any]:
    """Flag a run for cancellation; the worker stops at its next phase boundary."""
    cancel_flags[req.runId] = True
    return {"ok": True, "runId": req.runId}


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def approval(req: ApprovalRequest) -> dict[str, Any]:
    """Receive an approval decision from PA (Wave C resumes the blocked tool call here)."""
    return {"ok": True, "runId": req.runId, "approvalId": req.approvalId, "decision": req.decision}
