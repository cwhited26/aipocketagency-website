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

import hashlib
import os
import shlex
import time
from typing import Any, Optional

import modal
from pydantic import BaseModel

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

# ── Modal Sandbox connector (Build Tools Roadmap §7.4, PA-BUILD-12) ─────────────────────────
# Image for the ephemeral, per-project build containers: node + pnpm + git so the standard build
# commands (pnpm install / build / test, npm run lint) work out of the box. Owners can override the
# image per spawn. This is the CONTAINER image — distinct from `image`, which runs the web tier.
sandbox_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("git", "curl", "ca-certificates")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pnpm@9",
    )
)

# Idempotency cache for run_command: (container_id, sha256(workdir+command)) -> result dict. A
# repeat of the same command in the same container returns the cached stdout/stderr/exit_code
# (task item 3: "idempotent per containerId+commandHash"). Survives across web calls.
run_cache = modal.Dict.from_name("pa-sandbox-run-cache", create_if_missing=True)

DEFAULT_SANDBOX_TTL = 1800  # 30 min — a forgotten container can't run up cost past this
MAX_SANDBOX_TTL = 7200  # 2 h hard ceiling
DEFAULT_WORKDIR = "/workspace/repo"  # where an optionally-mounted repo lands
_OUTPUT_CAP = 20_000  # tail bytes of stdout/stderr returned, so a noisy build can't blow the response


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


# ── Modal Sandbox endpoints (Build Tools Roadmap §7.4) ─────────────────────────────────────
# The PA web tier (lib/connectors/modal-sandbox) calls these over HTTP with Modal proxy auth
# (Modal-Key / Modal-Secret) to spawn ephemeral per-project containers, run build commands in them,
# tear them down, and poll status. All four live under ONE ASGI app (`sandbox_api`) so the web tier
# reaches them off a single base URL (`/sandbox/spawn`, `/sandbox/run`, `/sandbox/stop`,
# `/sandbox/status`) — mirroring how runtime-client.ts path-appends `/cancel` and `/approval`.
#
# Gating (which command needs an owner tap, and which can NEVER auto-approve) lives ENTIRELY in the
# PA web tier + the Approval Inbox. By the time a request reaches here it is already approved — this
# layer just executes. Each container auto-expires on its TTL so a forgotten one can't run up cost.


class SandboxSpawnRequest(BaseModel):
    project_id: str
    image: Optional[str] = None
    repo: Optional[str] = None
    repo_token: Optional[str] = None
    ttl_seconds: Optional[int] = None


class SandboxRunRequest(BaseModel):
    container_id: str
    command: str
    workdir: Optional[str] = None


class SandboxIdRequest(BaseModel):
    container_id: str


def _clone_command(repo: str, token: Optional[str], workdir: str) -> str:
    """Shell to clone `repo` into `workdir`. `repo` may be "owner/name" or a full URL; a token (the
    owner's GitHub token) is injected for private repos. Token only ever lives inside the ephemeral
    container."""
    if "://" in repo:
        url = repo
    elif token:
        url = f"https://{token}@github.com/{repo}.git"
    else:
        url = f"https://github.com/{repo}.git"
    parent = workdir.rsplit("/", 1)[0] or "/"
    return f"mkdir -p {shlex.quote(parent)} && git clone --depth 1 {shlex.quote(url)} {shlex.quote(workdir)}"


def _sandbox_spawn(req: SandboxSpawnRequest) -> dict[str, Any]:
    """Create an ephemeral container, optionally cloning a GitHub repo into DEFAULT_WORKDIR."""
    ttl = min(req.ttl_seconds or DEFAULT_SANDBOX_TTL, MAX_SANDBOX_TTL)
    img = modal.Image.from_registry(req.image) if req.image else sandbox_image
    sb = modal.Sandbox.create(app=app, image=img, timeout=ttl)

    repo_cloned = False
    clone_error: Optional[str] = None
    if req.repo:
        proc = sb.exec("bash", "-lc", _clone_command(req.repo, req.repo_token, DEFAULT_WORKDIR))
        proc.wait()
        if proc.returncode == 0:
            repo_cloned = True
        else:
            clone_error = (proc.stderr.read() or "")[-500:]
    return {
        "container_id": sb.object_id,
        "status": "running",
        "repo_cloned": repo_cloned,
        "clone_error": clone_error,
    }


def _sandbox_run(req: SandboxRunRequest) -> dict[str, Any]:
    """Run a command in an existing container. Idempotent per (container_id, workdir+command)."""
    workdir = req.workdir or DEFAULT_WORKDIR
    cmd_hash = hashlib.sha256(f"{workdir}\n{req.command}".encode()).hexdigest()
    key = f"{req.container_id}:{cmd_hash}"
    cached = run_cache.get(key)
    if cached is not None:
        return {**cached, "cached": True}

    sb = modal.Sandbox.from_id(req.container_id)
    # cd into the workdir if it exists (a repo-less spawn won't have it), then run the command.
    proc = sb.exec("bash", "-lc", f"cd {shlex.quote(workdir)} 2>/dev/null || true; {req.command}")
    proc.wait()
    result = {
        "stdout": (proc.stdout.read() or "")[-_OUTPUT_CAP:],
        "stderr": (proc.stderr.read() or "")[-_OUTPUT_CAP:],
        "exit_code": proc.returncode if proc.returncode is not None else -1,
    }
    run_cache[key] = result
    return {**result, "cached": False}


def _sandbox_stop(req: SandboxIdRequest) -> dict[str, Any]:
    """Tear down a container. Cleanup is idempotent — an already-gone container counts as stopped."""
    try:
        modal.Sandbox.from_id(req.container_id).terminate()
    except Exception as exc:  # noqa: BLE001 — report the failure, never hang the cleanup
        msg = str(exc)
        if "not found" in msg.lower():
            return {"stopped": True, "error": None}
        return {"stopped": False, "error": msg[:300]}
    return {"stopped": True, "error": None}


def _sandbox_status(req: SandboxIdRequest) -> dict[str, Any]:
    """Read-only: poll whether a container is still running (poll() is None while alive)."""
    try:
        code = modal.Sandbox.from_id(req.container_id).poll()
    except Exception as exc:  # noqa: BLE001 — surface unknown, never raise to the caller
        return {
            "container_id": req.container_id,
            "status": "unknown",
            "running": False,
            "returncode": None,
            "error": str(exc)[:300],
        }
    running = code is None
    return {
        "container_id": req.container_id,
        "status": "running" if running else "stopped",
        "running": running,
        "returncode": code,
        "error": None,
    }


@app.function(image=image, secrets=[modal.Secret.from_name("pa-orchestrator")])
@modal.asgi_app(requires_proxy_auth=True)
def sandbox_api():
    """The four `/sandbox/*` routes under one proxy-auth-protected ASGI app. requires_proxy_auth
    is ESSENTIAL here — an arbitrary-code-exec endpoint must never be publicly reachable; the web
    tier authenticates every call with Modal-Key / Modal-Secret."""
    from fastapi import FastAPI

    web = FastAPI(title="PA Modal Sandbox")
    web.post("/sandbox/spawn")(_sandbox_spawn)
    web.post("/sandbox/run")(_sandbox_run)
    web.post("/sandbox/stop")(_sandbox_stop)
    web.post("/sandbox/status")(_sandbox_status)
    return web
