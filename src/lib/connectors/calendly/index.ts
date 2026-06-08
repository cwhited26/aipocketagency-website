// connectors/calendly/index.ts — the Calendly connector entry point.
//
// Exposes the action list + per-action approval gate (for the approval middleware and UI), and the
// TS executor that performs an action against the Calendly API v2. Calendly is an IN-PROCESS
// connector (TypeScript + direct REST, like Calendar): reads run inline, and a write fires here in
// the Next runtime the moment the owner approves via /api/connections/calendly/approve/[id] — no
// Modal sub-agent makes the Calendly call.
//
// Per the Wave B contract, a sub-agent never calls Calendly directly: it stages the action via the
// approval middleware (lib/orchestrator/tool-use.ts → stageConnectorAction), which scope-checks it
// (ContainmentGuard) and writes the Inbox + approval + audit rows. The staged write fires when the
// owner approves and runCalendlyAction runs.

import {
  fetchCalendlyConnectionFull,
  markCalendlyConnectionError,
} from "@/lib/pa-calendly-connections";
import { ensureFreshCalendlyToken, hasCalendlyScope } from "./oauth";
import { getUserOrganization } from "./api";
import type {
  ActionExecOutcome,
  ApprovalGate,
  CalendlyActionMeta,
  CalendlyActionName,
} from "./types";

import { listEventTypesAction, ListEventTypesInputSchema } from "./actions/list_event_types";
import {
  listScheduledEventsAction,
  ListScheduledEventsInputSchema,
} from "./actions/list_scheduled_events";
import { listInviteesAction, ListInviteesInputSchema } from "./actions/list_invitees";
import { createOneOffLinkAction, CreateOneOffLinkInputSchema } from "./actions/create_one_off_link";
import {
  cancelScheduledEventAction,
  CancelScheduledEventInputSchema,
} from "./actions/cancel_scheduled_event";

export const CONNECTOR = "calendly" as const;

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────
export const CALENDLY_ACTIONS: readonly CalendlyActionMeta[] = [
  listEventTypesAction,
  listScheduledEventsAction,
  listInviteesAction,
  createOneOffLinkAction,
  cancelScheduledEventAction,
].map((a) => ({
  name: a.name,
  connector: CONNECTOR,
  action: a.action,
  description: a.description,
  gate: a.gate,
}));

const GATES: Record<CalendlyActionName, ApprovalGate> = {
  list_event_types: listEventTypesAction.gate,
  list_scheduled_events: listScheduledEventsAction.gate,
  list_invitees: listInviteesAction.gate,
  create_one_off_link: createOneOffLinkAction.gate,
  cancel_scheduled_event: cancelScheduledEventAction.gate,
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isCalendlyAction(action: string): action is CalendlyActionName {
  return KNOWN_ACTIONS.has(action);
}

export function calendlyActionGate(action: CalendlyActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely. */
export function isCalendlyReadOnly(action: CalendlyActionName): boolean {
  return GATES[action] === "read";
}

/** Write actions (approval-gated) — the names the gating + trust-ladder logic key on. */
export const CALENDLY_WRITE_ACTIONS: readonly CalendlyActionName[] = (
  Object.keys(GATES) as CalendlyActionName[]
).filter((a) => GATES[a] === "gated");

// ── Execute against the Calendly API (payload validated per-action) ─────────────────────────

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

/**
 * Validate `payload` with the action's schema and run it. `userUri` is the connected user's
 * resource URI (required by the event-type + scheduled-event reads). `organizationUri` is resolved
 * upstream (runCalendlyAction) only for list_scheduled_events, which Calendly scopes by
 * (user, organization); other actions ignore it.
 */
export async function executeCalendlyAction(
  action: CalendlyActionName,
  args: {
    accessToken: string;
    userUri: string;
    organizationUri: string | null;
    payload: Record<string, unknown>;
  },
): Promise<ActionExecOutcome> {
  switch (action) {
    case "list_event_types": {
      const parsed = ListEventTypesInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listEventTypesAction.execute({
        accessToken: args.accessToken,
        userUri: args.userUri,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Found ${r.data.eventTypes.length} meeting type(s).`,
        data: { eventTypes: r.data.eventTypes },
      };
    }
    case "list_scheduled_events": {
      const parsed = ListScheduledEventsInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      if (!args.organizationUri) {
        return {
          ok: false,
          status: 502,
          error: "Couldn't resolve your Calendly organization — reconnect Calendly.",
          authError: false,
        };
      }
      const r = await listScheduledEventsAction.execute({
        accessToken: args.accessToken,
        userUri: args.userUri,
        organizationUri: args.organizationUri,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Found ${r.data.events.length} booking(s).`,
        data: { events: r.data.events },
      };
    }
    case "list_invitees": {
      const parsed = ListInviteesInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listInviteesAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Found ${r.data.invitees.length} invitee(s).`,
        data: { invitees: r.data.invitees },
      };
    }
    case "create_one_off_link": {
      const parsed = CreateOneOffLinkInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await createOneOffLinkAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Created a booking link: ${r.data.bookingUrl}`,
        data: { bookingUrl: r.data.bookingUrl },
      };
    }
    case "cancel_scheduled_event": {
      const parsed = CancelScheduledEventInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await cancelScheduledEventAction.execute({
        accessToken: args.accessToken,
        input: parsed.data,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Canceled booking ${r.data.eventUri}.`,
        data: { eventUri: r.data.eventUri, reason: r.data.reason },
      };
    }
    default: {
      // Exhaustiveness: every CalendlyActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown Calendly action: ${String(_never)}`);
    }
  }
}

// ── High-level: resolve the connection + token + user URI, then execute ─────────────────────

export type RunCalendlyResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; reauth: boolean };

/**
 * Resolve the owner's Calendly connection, ensure a fresh access token (refreshing + flipping to
 * reauth on failure), then execute the action. For list_scheduled_events the organization URI is
 * resolved from the stored user URI first (Calendly scopes that read by user + org). `reauth:true`
 * signals the caller to surface the reconnect path (a dead grant, missing connection, missing user
 * URI, or missing scope marker). `ownerEmail` is the OWNER's email for the re-auth nudge.
 */
export async function runCalendlyAction(input: {
  userId: string;
  action: CalendlyActionName;
  payload: Record<string, unknown>;
  ownerEmail: string | null;
}): Promise<RunCalendlyResult> {
  const conn = await fetchCalendlyConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error, reauth: false };
  if (!conn.data || conn.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect Calendly in Settings → Connections first.",
      reauth: true,
    };
  }
  if (!conn.data.userUri) {
    return {
      ok: false,
      status: 409,
      error: "Calendly connection is missing its user reference — reconnect Calendly.",
      reauth: true,
    };
  }
  if (!hasCalendlyScope(conn.data.scopes)) {
    return {
      ok: false,
      status: 403,
      error: "Re-authorize Calendly — Settings → Connections → Reconnect.",
      reauth: true,
    };
  }

  const token = await ensureFreshCalendlyToken(conn.data, input.ownerEmail);
  if (!token.ok) {
    return {
      ok: false,
      status: 502,
      error: "Calendly authorization expired — reconnect Calendly in Settings.",
      reauth: true,
    };
  }

  // scheduled_events is scoped by (user, organization); resolve the org from the user resource.
  let organizationUri: string | null = null;
  if (input.action === "list_scheduled_events") {
    const org = await getUserOrganization(token.data, conn.data.userUri);
    if (!org.ok) {
      if (org.authError) {
        await markCalendlyConnectionError(conn.data.id);
        return { ok: false, status: org.status, error: "Calendly authorization expired — reconnect Calendly.", reauth: true };
      }
      return { ok: false, status: org.status, error: "Couldn't read your Calendly organization.", reauth: false };
    }
    organizationUri = org.data;
  }

  const outcome = await executeCalendlyAction(input.action, {
    accessToken: token.data,
    userUri: conn.data.userUri,
    organizationUri,
    payload: input.payload,
  });
  if (!outcome.ok) {
    if (outcome.authError) {
      await markCalendlyConnectionError(conn.data.id);
      return { ok: false, status: outcome.status, error: outcome.error, reauth: true };
    }
    return { ok: false, status: outcome.status, error: outcome.error, reauth: false };
  }
  return { ok: true, summary: outcome.summary, data: outcome.data };
}

// Re-export the typed action descriptors for unit tests that exercise the pure functions.
export {
  listEventTypesAction,
  listScheduledEventsAction,
  listInviteesAction,
  createOneOffLinkAction,
  cancelScheduledEventAction,
};
