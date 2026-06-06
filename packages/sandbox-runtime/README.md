# PA Orchestrator Runtime (Modal)

The Pocket Agent v5 Wave B sub-agent runtime. The PA web tier (Node) dispatches a run here over
HTTP; this Modal app drives the **7-phase Algorithm** (OBSERVE → THINK → PLAN → BUILD → EXECUTE
→ VERIFY → LEARN) and reports phase progress, staged actions, and completion back to PA's
webhook. Long-running multi-step work that Vercel functions can't hold runs here; Modal's
pay-per-second economics line up with the agent-minute tier caps (PA-ORCH-5).

**Decision PA-ORCH-3 / PA-ORCH-14:** runtime = Modal.

## Layout

| File | Role |
|---|---|
| `app.py` | Modal app + web endpoints (`/dispatch`, `/cancel`, `/approval`) + the spawned 7-phase worker. |
| `algorithm.py` | Pure core — Pydantic request models + 7-phase helpers + webhook-event builders (no Modal/network). |
| `client.py` | Thin PA REST API client (zone-scoped brain reads + user-provider LLM) + the webhook poster. Direct `httpx`, no SDK. |
| `containment_guard.py` | Python port of the action-path ContainmentGuard (PA-ORCH-9), 1:1 with the TS guard. |
| `tests/` | `pytest` suites for the pure core + the guard (run without Modal). |

The webhook events `algorithm.py` emits match `src/lib/orchestrator/types.ts` `WebhookEventSchema`
exactly (camelCase keys), so the PA web tier validates them with Zod on arrival.

## Test (no Modal needed)

```bash
cd packages/sandbox-runtime
uv run pytest          # or: pip install pytest pydantic httpx && pytest
uv run mypy .          # strict type check
```

## Deploy

1. Install Modal + authenticate:
   ```bash
   pip install modal
   modal token new            # creates MODAL_TOKEN_ID / MODAL_TOKEN_SECRET
   ```
2. Create the Modal secret the worker reads (PA REST API base + key the runtime uses for brain +
   LLM, and the webhook shared secret are passed per-call, not here):
   ```bash
   modal secret create pa-orchestrator \
     PA_API_BASE_URL=https://aipocketagent.com \
     PA_API_KEY=pa_live_xxx
   ```
3. Deploy:
   ```bash
   modal deploy app.py
   ```
4. Modal prints the deployed web URL for `dispatch`. Set it (without the `/dispatch` suffix — the
   Node client appends paths) on Vercel as **`PA_ORCHESTRATOR_RUNTIME_URL`**, and set a shared
   **`PA_ORCHESTRATOR_RUNTIME_TOKEN`** on both Vercel and as part of the dispatch payload's
   callback secret (the Node tier sends it; the webhook verifies it).

## Auth model

- **PA → runtime:** the Node `runtime-client.ts` sends `Modal-Key` / `Modal-Secret` headers
  (`MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`). Enable Modal proxy auth on the endpoints for
  defense in depth.
- **runtime → PA:** every webhook carries `x-pa-runtime-token: $PA_ORCHESTRATOR_RUNTIME_TOKEN`,
  which `/api/orchestrator/webhook` verifies with a constant-time comparison before touching the
  run.

## Scope (Wave B)

This runtime **stages** connector write-actions for approval (EXECUTE phase → `action_staged`
webhook → owner approves in the Inbox/chat). It does **not** execute connector side-effects yet —
the connector write-action library (Gmail send, Stripe invoice, …) is **Wave C**. Until then a run
plans, reasons, stages its actions for approval, and reports completion.
