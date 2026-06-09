# Modal Sandbox connector — actions

Code-execution surface for the build pack (Build Tools Roadmap §7.4, PA-BUILD-12). Unlike the
productivity connectors, Modal is **platform infrastructure**: there is no OAuth and no per-owner
token. Every action drives the Wave B Modal app (`pa-orchestrator-runtime`) using the platform Modal
credentials (`MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`). Containers are **ephemeral and scoped to one
Project's task** — born for a build, run their command, and die on `stop_container` or their TTL.

Connector id: `modal_sandbox`. In-process executor: `executeModalSandboxConnectorAction`
(registered in `lib/connectors/registry.ts`, fires from the approval route on approve).

| Action | Gate | Input | What it does |
|---|---|---|---|
| `spawn_container` | gated (trust window) | `{ project_id, image?, repo?, repo_token?, ttl_seconds? }` | Creates an ephemeral container, optionally cloning a GitHub repo. On success records `modal_container_id` to the Project Workspace via `extendWorkspace` (migration 045, PA-BUILD-8). |
| `run_command` | **gated** for ordinary build commands; **always_gated** (single-approval FOREVER) for shell-special / network / destructive commands | `{ container_id, command, workdir? }` | Runs a command (e.g. `pnpm install` / `pnpm run build` / `pnpm test` / `npm run lint`). Returns `{ stdout, stderr, exit_code, cached }`. Idempotent per `(container_id, workdir+command)`. |
| `stop_container` | auto (no approval — cleanup only) | `{ container_id }` | Tears the container down. Idempotent. |
| `get_container_status` | read (no approval) | `{ container_id }` | Polls whether the container is still running. |

## The run_command guardrail (task item 3 / Roadmap §11)

`run_command` is **single-approval forever — never auto-approve eligible** for any command that
contains a shell-special character (`;` `&&` `||` `|` backticks `$(` redirection `>`/`<` `&`) **or**
matches a high-blast-radius tool (`curl`, `wget`, `eval`, `rm -rf`). An arbitrary shell command in a
container that can reach the owner's repo and the network is the prime prompt-injection target, so
every such command is an explicit per-action owner tap, no matter how many were approved before.

Ordinary, single-program build commands (`pnpm install`, `pnpm run build`, `pnpm test`,
`npm run lint`) carry no metacharacter and match no dangerous tool, so they follow the ordinary
PA-ORCH-4 trust window.

This bar depends on the command **payload**, not the action name, so it cannot live in the
`CONNECTOR_ACTION_TRUST_OVERRIDES` (connector, action) map. It is enforced in `commands.ts`
(`isDangerousCommand` / `runCommandGate`) and surfaced via `isModalSandboxNeverAutoApprove`, which
the staging + auto-approve-toggle layers consult.

## Approval card

A staged `run_command` / `spawn_container` shows the full command, the working directory, the
container id, a "Sandbox" badge, and — for a shell-special command — the `dangerReason` warning that
it will always ask before running. (When the build-pack `build_action_approval` Inbox kind lands,
the card re-points to it; until then sandbox actions stage through the existing `action_approval`
kind.)

## Runtime / config

- Endpoints: `POST /sandbox/{spawn,run,stop,status}` on the Modal app (`packages/sandbox-runtime/app.py`,
  one proxy-auth-protected ASGI app).
- Base URL: `PA_SANDBOX_RUNTIME_URL`, or derived from `PA_ORCHESTRATOR_RUNTIME_URL` when unset.
- Auth: Modal proxy headers (`Modal-Key` / `Modal-Secret`) — the same platform credentials Wave B
  already uses. No new connection, no owner setup.
