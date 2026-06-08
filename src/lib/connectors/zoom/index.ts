// connectors/zoom/index.ts — the Zoom connector entry point.
//
// Exposes the action registry + per-action approval gate (for the middleware + UI), the auto-
// approve eligibility policy, and executeZoomAction — the in-process executor the approval route
// calls via lib/connectors/registry.ts the moment the owner approves a staged write (and that the
// read endpoint + chat tools call directly for reads). Zoom is a TypeScript + direct-REST connector
// (no Modal sub-agent makes the Zoom call), so execution happens here in the Next runtime.
//
// This connector acts on the OWNER's own Zoom account (provider='zoom', User-level OAuth). Auth is
// the owner's access token; the owner's zoom_user_id is threaded into the user-scoped meeting paths.
//
// Every failure is a typed result (never a silent catch); a hard auth failure additionally flips
// the connection to status='error' and fires the re-auth email (roadmap §3.5, via oauth.ts).

import {
  countRecentConnectorActions,
  logConnectorAction,
  OrchestratorDbError,
} from "@/lib/orchestrator/db";
import { fetchZoomConnectionFull, markZoomConnectionError } from "@/lib/pa-zoom-connections";
import { ensureFreshZoomToken, notifyZoomReauthNeeded } from "./oauth";
import type { ActionExecOutcome, ApprovalGate, ZoomActionMeta, ZoomActionName } from "./types";

import {
  listUpcomingMeetingsAction,
  ListUpcomingMeetingsInputSchema,
} from "./actions/list_upcoming_meetings";
import { getMeetingLinkAction, GetMeetingLinkInputSchema } from "./actions/get_meeting_link";
import { createMeetingAction, CreateMeetingInputSchema } from "./actions/create_meeting";
import { updateMeetingAction, UpdateMeetingInputSchema } from "./actions/update_meeting";
import { cancelMeetingAction, CancelMeetingInputSchema } from "./actions/cancel_meeting";

export const ZOOM_CONNECTOR = "zoom";

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────
export const ZOOM_ACTIONS: readonly ZoomActionMeta[] = [
  listUpcomingMeetingsAction,
  getMeetingLinkAction,
  createMeetingAction,
  updateMeetingAction,
  cancelMeetingAction,
].map((a) => ({
  name: a.name,
  connector: ZOOM_CONNECTOR,
  action: a.action,
  description: a.description,
  gate: a.gate,
}));

const GATES: Record<ZoomActionName, ApprovalGate> = {
  list_upcoming_meetings: listUpcomingMeetingsAction.gate,
  get_meeting_link: getMeetingLinkAction.gate,
  create_meeting: createMeetingAction.gate,
  update_meeting: updateMeetingAction.gate,
  cancel_meeting: cancelMeetingAction.gate,
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isZoomAction(action: string): action is ZoomActionName {
  return KNOWN_ACTIONS.has(action);
}

export function zoomActionGate(action: ZoomActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely. */
export function isZoomReadOnly(action: ZoomActionName): boolean {
  return GATES[action] === "read";
}

/** Mutating (write) actions — what the per-minute cap + gating key on. */
export const ZOOM_WRITE_ACTIONS: readonly ZoomActionName[] = (
  Object.keys(GATES) as ZoomActionName[]
).filter((a) => GATES[a] !== "read");

/** True iff the action is auto-approve eligible without clearing the trust window (reads only). */
export function isZoomAutoApproveEligibleByDefault(action: ZoomActionName): boolean {
  return GATES[action] === "read";
}

// ── Execute against the Zoom API (payload validated per-action) ─────────────────────────────

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

async function executeZoomActionCore(
  action: ZoomActionName,
  args: { accessToken: string; zoomUserId: string; payload: Record<string, unknown> },
): Promise<ActionExecOutcome> {
  switch (action) {
    case "list_upcoming_meetings": {
      const parsed = ListUpcomingMeetingsInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listUpcomingMeetingsAction.execute({
        accessToken: args.accessToken,
        zoomUserId: args.zoomUserId,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Found ${r.data.meetings.length} upcoming meeting(s).`,
        data: { meetings: r.data.meetings },
      };
    }
    case "get_meeting_link": {
      const parsed = GetMeetingLinkInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await getMeetingLinkAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: r.data.joinUrl ? `Join link: ${r.data.joinUrl}` : `Meeting ${r.data.meetingId} has no join link.`,
        data: { meetingId: r.data.meetingId, topic: r.data.topic, joinUrl: r.data.joinUrl, start: r.data.start },
      };
    }
    case "create_meeting": {
      const parsed = CreateMeetingInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await createMeetingAction.execute({
        accessToken: args.accessToken,
        zoomUserId: args.zoomUserId,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Created Zoom meeting "${parsed.data.topic}" (${r.data.meetingId}).`,
        data: { meetingId: r.data.meetingId, joinUrl: r.data.joinUrl, startUrl: r.data.startUrl },
      };
    }
    case "update_meeting": {
      const parsed = UpdateMeetingInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await updateMeetingAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return { ok: true, summary: `Updated Zoom meeting ${r.data.meetingId}.`, data: { meetingId: r.data.meetingId } };
    }
    case "cancel_meeting": {
      const parsed = CancelMeetingInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await cancelMeetingAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return { ok: true, summary: `Canceled Zoom meeting ${r.data.meetingId}.`, data: { meetingId: r.data.meetingId } };
    }
    default: {
      // Exhaustiveness: every ZoomActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown zoom action: ${String(_never)}`);
    }
  }
}

// ── High-level: resolve the connection + fresh token, then execute ──────────────────────────

export type ZoomExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type RunZoomActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  subAgentRunId?: string | null;
  /** Owner email for the re-auth nudge on a hard auth failure (best-effort). */
  ownerEmail?: string | null;
};

// Per-user-per-minute write cap (roadmap abuse note). Configurable; safe default 20/min.
const DEFAULT_MAX_WRITES_PER_MIN = 20;

export function zoomMaxWritesPerMin(): number {
  const raw = process.env.PA_ZOOM_MAX_WRITES_PER_MIN;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_WRITES_PER_MIN;
  return n;
}

/** Pure: is a new write blocked given how many writes already fired in the window? */
export function rateCapExceeded(recentWrites: number, cap: number): boolean {
  return recentWrites >= cap;
}

/**
 * Execute one Zoom action for an owner. Used by the approval route on approve (writes — via the
 * registry) and by the read endpoint + chat tools (reads). Resolves the connection + a fresh access
 * token, runs the action, and audit-logs mutating outcomes. A hard auth failure flips the
 * connection to status='error' and fires the re-auth email (roadmap §3.5).
 */
export async function executeZoomAction(input: RunZoomActionInput): Promise<ZoomExecuteResult> {
  if (!isZoomAction(input.action)) {
    return { ok: false, status: 400, error: `Unknown Zoom action: ${input.action}` };
  }
  const action = input.action;

  const conn = await fetchZoomConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error };
  if (!conn.data || conn.data.status === "revoked" || !conn.data.zoom_user_id) {
    return {
      ok: false,
      status: 409,
      error: "Connect Zoom in Settings → Connections before running Zoom actions.",
    };
  }

  const mutating = !isZoomReadOnly(action);

  // Per-minute write cap — checked before the token round-trip so a burst is cheap to reject.
  if (mutating) {
    const cap = zoomMaxWritesPerMin();
    const since = new Date(Date.now() - 60_000).toISOString();
    let recent: number;
    try {
      recent = await countRecentConnectorActions({
        businessId: input.userId,
        connector: ZOOM_CONNECTOR,
        status: "executed",
        sinceIso: since,
        actions: ZOOM_WRITE_ACTIONS,
      });
    } catch (e) {
      if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) recent = 0;
      else throw e;
    }
    if (rateCapExceeded(recent, cap)) {
      return {
        ok: false,
        status: 429,
        error: `Zoom write rate cap reached (${cap}/min). Try again in a minute.`,
      };
    }
  }

  const token = await ensureFreshZoomToken(conn.data, input.ownerEmail ?? conn.data.email);
  if (!token.ok) {
    if (token.authError) {
      return {
        ok: false,
        status: 401,
        error: "Zoom disconnected — reconnect Zoom in Settings → Connections.",
      };
    }
    return { ok: false, status: token.status, error: "Couldn't get a Zoom token. Try again." };
  }

  const outcome = await executeZoomActionCore(action, {
    accessToken: token.data,
    zoomUserId: conn.data.zoom_user_id,
    payload: input.payload,
  });

  if (!outcome.ok) {
    if (mutating) await logExecuted(input, action, "failed", outcome.error);
    if (outcome.authError) {
      await markZoomConnectionError(conn.data.id);
      await notifyZoomReauthNeeded(input.ownerEmail ?? conn.data.email);
      return {
        ok: false,
        status: 401,
        error: "Zoom disconnected — reconnect Zoom in Settings → Connections.",
      };
    }
    return { ok: false, status: outcome.status, error: outcome.error };
  }

  if (mutating) await logExecuted(input, action, "executed", outcome.summary);
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Audit-log the terminal outcome of a write. Best-effort: a missing audit table (migration not
// applied) must not fail an otherwise-successful action. payload_hash is empty here — the staged
// row (written by the middleware) carries the canonical hash; this row records outcome.
async function logExecuted(
  input: RunZoomActionInput,
  action: ZoomActionName,
  status: "executed" | "failed",
  summary: string,
): Promise<void> {
  try {
    await logConnectorAction({
      businessId: input.userId,
      subAgentRunId: input.subAgentRunId ?? null,
      connector: ZOOM_CONNECTOR,
      action,
      payloadHash: "",
      status,
      responseSummary: summary.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrchestratorDbError && e.schemaNotProvisioned) return;
    throw e;
  }
}
