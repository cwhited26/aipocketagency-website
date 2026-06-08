# Slack connector — action library

Connections Roadmap §2.1. Direct REST to the Slack Web API (no SDK). Every write is
approval-gated through the Wave B middleware (`pa_action_approvals` + `pa_inbox_items`
kind=`action_approval`); reads run un-gated.

| Action | Type | Gate | Payload | Slack method |
|---|---|---|---|---|
| `post_message` | write | per-action approval (trust ladder → auto-approve after 10) | `{ channel, text, blocks? }` | `chat.postMessage` |
| `post_in_thread` | write | per-action approval | `{ channel, thread_ts, text }` | `chat.postMessage` (thread_ts) |
| `send_dm` | write | per-action approval; auto-approve stays per-recipient | `{ user_id, text }` | `conversations.open` → `chat.postMessage` |
| `list_channels` | read | none (auto-approve eligible by default) | `{ limit?, exclude_archived? }` | `conversations.list` |
| `list_recent_messages` | read | none (auto-approve eligible by default) | `{ channel, limit? }` | `conversations.history` |

## Approval-gate model

- Writes stage through `stageConnectorAction` (scope-checked by ContainmentGuard, fail closed),
  then **fire on approve** via `executeConnectorAction` → `executeSlackAction` (server-side,
  in-process — Slack is TypeScript + direct REST, not a Modal sub-agent call).
- Reads are auto-approve eligible from day one and execute directly via `executeSlackAction`.
- Trust ladder (PA-ORCH-4): a write earns an auto-approve toggle after 10 successful approvals.
  When the toggle is on, the webhook auto-executes the staged action in-process.

## Drafter behavior (roadmap §2.1)

`buildThreadReplyDraft(source, text)` auto-populates `channel` + `thread_ts` from the source
surface (the thread the owner is viewing) and **refuses with a clear error** when the thread
context is missing — it never free-types a channel.

## Abuse defense (roadmap §8)

- HTTP 429 backoff with bounded Retry-After honoring (`lib/slack.ts`).
- Per-user-per-minute write cap (`PA_SLACK_MAX_SENDS_PER_MIN`, default 30) counted from the
  audit log so it holds across serverless invocations.

## Re-auth (roadmap §3.5)

On `invalid_auth` / `token_revoked` the connection flips to `status='error'`, the card shows
"Reconnect needed", and a Resend system email nudges the owner (`notifySlackReauthNeeded`).

## Env vars (Vercel)

`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`. Reuses
`GMAIL_TOKEN_ENCRYPTION_KEY` (token encryption) and `PA_OAUTH_REDIRECT_BASE` (redirect base).
