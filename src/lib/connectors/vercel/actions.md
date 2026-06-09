# Vercel connector — action library

Build Tools Roadmap §7.2 (the second of four build connectors). Direct REST to the Vercel REST
API at `https://api.vercel.com` (no Vercel SDK). Vercel has no user-facing OAuth, so the owner
pastes a personal or team API token once; it is stored AES-256-GCM encrypted in
`pa_connections.config` (provider `vercel`). Every write stages an Inbox card with
kind=`build_action_approval`; the read runs un-gated.

| Action | Type | Gate | Payload | Vercel endpoint |
|---|---|---|---|---|
| `createProject` | write | per-action approval (trust ladder → auto-approve after 10) | `{ name, framework?, gitRepo?, projectId? }` | `POST /v11/projects` |
| `setEnvVar` | write | per-action approval; encrypted by default | `{ projectId, key, value, target[], encrypted? }` | `POST /v10/projects/{id}/env` |
| `triggerDeploy` | write | per-action approval | `{ projectId, name?, ref?, production? }` | `POST /v13/deployments` |
| `getDeploymentStatus` | read | none (no approval needed) | `{ deploymentId }` | `GET /v13/deployments/{id}` |
| `attachDomain` | write | **single-approval FOREVER** — never auto-approves | `{ projectId, domain }` | `POST /v10/projects/{id}/domains` |

Team-scoped tokens thread `?teamId=` onto every call so create/deploy land on the owner's team
rather than their personal scope.

## Approval-gate model

- Writes stage through `stageConnectorAction({ kind: "build_action_approval" })` (scope-checked by
  ContainmentGuard, fail closed), then **fire on approve** via `executeConnectorAction` →
  `executeVercelConnectorAction` (server-side, in-process — Vercel is TypeScript + direct REST, not
  a Modal sub-agent call). The same `/api/orchestrator/approvals/[id]` route resolves both
  `action_approval` and `build_action_approval` cards; dispatch is keyed on the approval's connector.
- The read (`getDeploymentStatus`) executes directly, no Inbox card.
- Trust ladder (PA-ORCH-4): a write earns an auto-approve toggle after 10 successful approvals —
  **except `attach_domain`**, whose trust window is `Infinity`
  (`tier-caps CONNECTOR_ACTION_TRUST_OVERRIDES["vercel:attach_domain"]`). Pointing a custom domain
  moves real DNS-routed traffic, so it is approved one action at a time, every time, forever. The
  auto-approve toggle route refuses to enable it and the approval route never reports it unlocked.

## Workspace write-back (roadmap §7.5)

On `createProject` success the executor records the new Vercel project on the originating PA
project's Workspace row (`pa_project_workspaces.vercel_project_id` + `vercel_project_name`), keyed
by the `projectId` threaded through the action payload. Best-effort: a missing workspace row never
turns a real project creation into a reported failure. `/api/app/projects/[id]/workspace` is the
same write surface for the UI and the sibling build connectors.

## Secrets

`setEnvVar` defaults to `type:"encrypted"` and never echoes the value back in the audit summary or
the result — only the key + target environments. `get_connection_string`-style secrets from the
Supabase lane land here as encrypted env vars.

## Re-auth

On a 401/403 from Vercel the connection flips to `status='error'` (`markVercelConnectionError`) and
the Connections card shows "Your saved token stopped working — paste a fresh one to reconnect."
