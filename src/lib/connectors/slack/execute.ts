// lib/connectors/slack/execute.ts — server-side execution of an approved Slack action.
//
// This is the "fires on approve" half of the approval gate: once the owner approves a staged
// Slack write (or for a read action that runs un-gated), this loads the connection, gets a fresh
// token, enforces the per-minute send cap, runs the Web API call, and writes the audit row.
// Connector writes are TypeScript + direct REST (no Modal sub-agent does the Slack call), so
// execution happens here in the Next runtime.
//
// Every failure is a typed result (never a silent catch); a hard auth failure additionally
// flips the connection to status='error' and fires the re-auth email (roadmap §3.5).

import {
  countRecentConnectorActions,
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import {
  fetchSlackConnectionFull,
  markSlackConnectionError,
} from "@/lib/pa-slack-connections";
import { ensureFreshSlackToken, notifySlackReauthNeeded } from "./oauth";
import { getSlackAction, SLACK_WRITE_ACTIONS } from "./index";

export const SLACK_CONNECTOR = "slack";

// Per-user-per-minute write cap (roadmap §8 abuse note). Configurable; safe default 30/min.
const DEFAULT_MAX_SENDS_PER_MIN = 30;

export function slackMaxSendsPerMin(): number {
  const raw = process.env.PA_SLACK_MAX_SENDS_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_SENDS_PER_MIN;
  return n;
}

/** Pure: is a new write blocked given how many writes already fired in the window? */
export function rateCapExceeded(recentWrites: number, cap: number): boolean {
  return recentWrites >= cap;
}

export type SlackExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type ExecuteSlackActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  /** Owner email for the re-auth nudge on a hard auth failure (best-effort). */
  ownerEmail?: string | null;
};

/**
 * Execute one Slack action for an owner. Used by the approval route on approve (writes) and is
 * safe to call for reads. Writes the audit row in every terminal case so the timeline — and the
 * rate-cap count — stay accurate.
 */
export async function executeSlackAction(
  input: ExecuteSlackActionInput,
): Promise<SlackExecuteResult> {
  const action = getSlackAction(input.action);
  if (!action) {
    return { ok: false, status: 400, error: `Unknown Slack action: ${input.action}` };
  }

  const conn = await fetchSlackConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error };
  if (!conn.data || conn.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect Slack in Settings → Connections before running Slack actions.",
    };
  }

  // Per-minute write cap — checked before the token round-trip so a burst is cheap to reject.
  if (action.mutates) {
    const cap = slackMaxSendsPerMin();
    const since = new Date(Date.now() - 60_000).toISOString();
    let recent: number;
    try {
      recent = await countRecentConnectorActions({
        businessId: input.userId,
        connector: SLACK_CONNECTOR,
        status: "executed",
        sinceIso: since,
        actions: SLACK_WRITE_ACTIONS,
      });
    } catch (e) {
      // If the audit table isn't provisioned yet, there's nothing to count — treat as 0 rather
      // than blocking. Any other DB error is real and surfaces.
      if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) recent = 0;
      else throw e;
    }
    if (rateCapExceeded(recent, cap)) {
      return {
        ok: false,
        status: 429,
        error: `Slack send rate cap reached (${cap}/min). Try again in a minute.`,
      };
    }
  }

  const token = await ensureFreshSlackToken(conn.data);
  if (!token.ok) {
    if (token.authError) {
      await markSlackConnectionError(conn.data.id);
      await notifySlackReauthNeeded(input.ownerEmail ?? null);
      return {
        ok: false,
        status: 401,
        error: "Slack disconnected — reconnect Slack in Settings → Connections.",
      };
    }
    return { ok: false, status: token.status, error: "Couldn't get a Slack token. Try again." };
  }

  const ran = await action.runFromPayload(token.data, input.payload);

  if (!ran.ok) {
    await logExecuted(input, "failed", ran.error);
    if (ran.authError) {
      await markSlackConnectionError(conn.data.id);
      await notifySlackReauthNeeded(input.ownerEmail ?? null);
      return {
        ok: false,
        status: 401,
        error: "Slack disconnected — reconnect Slack in Settings → Connections.",
      };
    }
    return { ok: false, status: ran.status, error: `Slack ${input.action} failed: ${ran.error}` };
  }

  await logExecuted(input, "executed", ran.data.summary);
  return { ok: true, summary: ran.data.summary, data: ran.data.data };
}

// Audit-log the terminal outcome. Best-effort: a missing audit table (migration not applied)
// must not fail an otherwise-successful send. payload_hash is intentionally empty here — the
// staged row (written by the middleware) carries the canonical hash; this row records outcome.
async function logExecuted(
  input: ExecuteSlackActionInput,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: SLACK_CONNECTOR,
      action: input.action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
