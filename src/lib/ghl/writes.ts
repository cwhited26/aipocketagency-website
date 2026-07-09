// writes.ts — the three Ship 2 write actions (SPEC §5.3), staged through the shipped
// action-approval pattern and executed through the connector registry. THE approval rule, in
// code: there is no call path from a Persona to the GHL API in this module — stageGhlWriteAction
// writes the Mission Control card; only executeGhlAction (invoked by the approvals route AFTER
// the owner taps Approve) touches GHL. All three actions carry an Infinity trust window
// (orchestrator/tier-caps.ts), so the generic auto-approve toggle can never fire one — the
// per-Skill-per-client auto-approve the SPEC sketches is Ship 5.
//
// Multi-tenant enforcement happens at EXECUTE time, not just staging: the executor re-resolves
// the entitlement (tier or pass) and requires the payload's locationId to be one of THIS owner's
// sync_state='synced' registry rows. A payload edited to point at another agency's location — or
// at this owner's own over-cap location — is blocked before any token is minted.

import { z } from "zod";
import { stageConnectorAction, payloadHash } from "@/lib/orchestrator/tool-use";
import { ghlApiCall } from "./client";
import {
  GHL_VERSION_CALENDARS,
  GHL_VERSION_CONTACTS,
  GHL_VERSION_CONVERSATIONS,
} from "./config";
import { resolveGhlAccess } from "./entitlement";
import { ensureFreshAgencyToken, mintLocationToken } from "./oauth";
import {
  fetchGhlConnectionFull,
  fetchSyncedLocation,
  insertGhlActionLog,
} from "./store";

export const GHL_CONNECTOR = "ghl";

export const GHL_ACTION_NAMES = ["create_contact", "send_sms", "book_appointment"] as const;
export type GhlActionName = (typeof GHL_ACTION_NAMES)[number];

export function isGhlActionName(action: string): action is GhlActionName {
  return (GHL_ACTION_NAMES as readonly string[]).includes(action);
}

// ─── Action payload schemas (Zod at the staging AND execute boundary) ─────────

export const CreateContactPayloadSchema = z.object({
  locationId: z.string().min(1),
  contact: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .refine(
      (c) => !!(c.firstName || c.lastName || c.name || c.email || c.phone),
      "contact needs at least a name, email, or phone",
    ),
});

export const SendSmsPayloadSchema = z.object({
  locationId: z.string().min(1),
  contactId: z.string().min(1),
  body: z.string().min(1).max(1600),
});

export const BookAppointmentPayloadSchema = z.object({
  locationId: z.string().min(1),
  contactId: z.string().min(1),
  calendarId: z.string().min(1),
  /** ISO 8601 start; GHL derives the end from the calendar's slot length when omitted. */
  startAt: z.string().min(1),
  endAt: z.string().optional(),
  title: z.string().optional(),
});

const PAYLOAD_SCHEMAS: Record<GhlActionName, z.ZodTypeAny> = {
  create_contact: CreateContactPayloadSchema,
  send_sms: SendSmsPayloadSchema,
  book_appointment: BookAppointmentPayloadSchema,
};

export type CreateContactPayload = z.infer<typeof CreateContactPayloadSchema>;
export type SendSmsPayload = z.infer<typeof SendSmsPayloadSchema>;
export type BookAppointmentPayload = z.infer<typeof BookAppointmentPayloadSchema>;

// ─── Staging (the Persona-facing side) ────────────────────────────────────────

const ACTION_TITLES: Record<GhlActionName, string> = {
  create_contact: "Create contact",
  send_sms: "Send SMS",
  book_appointment: "Book appointment",
};

export type StageGhlWriteInput = {
  userId: string;
  subAgentRunId: string | null;
  action: GhlActionName;
  payload: Record<string, unknown>;
  declaredScopes: readonly string[];
  /** The client's display name — REQUIRED so the card names the sub-account it fires against. */
  locationName: string;
  /** Extra card lines (e.g. the SMS body preview). */
  previewDetail?: string;
};

/**
 * Stage one GHL write for owner approval. The card title carries the client name (SPEC §5.5 —
 * which client an action affects is never obscured); the payload is Zod-validated here so a
 * malformed action never reaches the Inbox.
 */
export async function stageGhlWriteAction(input: StageGhlWriteInput): Promise<{
  inboxItemId: string;
  autoApproved: boolean;
}> {
  const parsed = PAYLOAD_SCHEMAS[input.action].safeParse(input.payload);
  if (!parsed.success) {
    throw new Error(`GHL ${input.action} payload invalid: ${parsed.error.issues[0]?.message}`);
  }
  const locationId = (parsed.data as { locationId: string }).locationId;
  const preview = [
    `**Client:** ${input.locationName} (\`${locationId}\`)`,
    input.previewDetail ?? "",
    "Approve to fire this against the client's GHL sub-account. Nothing runs until you do.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const staged = await stageConnectorAction({
    userId: input.userId,
    subAgentRunId: input.subAgentRunId,
    connector: GHL_CONNECTOR,
    action: input.action,
    payload: parsed.data as Record<string, unknown>,
    declaredScopes: input.declaredScopes,
    title: `GHL · ${ACTION_TITLES[input.action]} — ${input.locationName}`,
    preview,
    kind: "action_approval",
  });
  return { inboxItemId: staged.inboxItemId, autoApproved: staged.autoApproved };
}

/**
 * Stage the same write against several client sub-accounts (SPEC §5.5 multi-tenant shape).
 * v1 fans out one approval card per location — each card names its client and executes
 * independently. The single-approval bulk fan-out with per-location retry + rollback is the
 * Ship 5 Bulk Op App.
 */
export async function stageGhlWriteActionForLocations(
  base: Omit<StageGhlWriteInput, "locationName"> & {
    locations: Array<{ locationId: string; locationName: string }>;
  },
): Promise<Array<{ locationId: string; inboxItemId: string }>> {
  const out: Array<{ locationId: string; inboxItemId: string }> = [];
  for (const loc of base.locations) {
    const staged = await stageGhlWriteAction({
      userId: base.userId,
      subAgentRunId: base.subAgentRunId,
      action: base.action,
      payload: { ...base.payload, locationId: loc.locationId },
      declaredScopes: base.declaredScopes,
      locationName: loc.locationName,
      previewDetail: base.previewDetail,
    });
    out.push({ locationId: loc.locationId, inboxItemId: staged.inboxItemId });
  }
  return out;
}

// ─── Execution (the approvals-route side, via the connector registry) ─────────

export type GhlExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export type ExecuteGhlActionInput = {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  /** The approval id — the deterministic idempotency seed for the cost row. */
  requestId: string | null;
};

type EndpointCall = {
  path: string;
  version: string;
  body: Record<string, unknown>;
  summary: (locationName: string) => string;
};

function endpointFor(action: GhlActionName, payload: Record<string, unknown>): EndpointCall {
  switch (action) {
    case "create_contact": {
      const p = payload as CreateContactPayload;
      return {
        path: "/contacts/",
        version: GHL_VERSION_CONTACTS,
        body: { locationId: p.locationId, ...p.contact },
        summary: (loc) => `Contact created in ${loc}'s sub-account.`,
      };
    }
    case "send_sms": {
      const p = payload as SendSmsPayload;
      return {
        path: "/conversations/messages",
        version: GHL_VERSION_CONVERSATIONS,
        body: { type: "SMS", contactId: p.contactId, message: p.body },
        summary: (loc) => `SMS sent to the contact in ${loc}'s sub-account.`,
      };
    }
    case "book_appointment": {
      const p = payload as BookAppointmentPayload;
      const body: Record<string, unknown> = {
        calendarId: p.calendarId,
        locationId: p.locationId,
        contactId: p.contactId,
        startTime: p.startAt,
      };
      if (p.endAt) body.endTime = p.endAt;
      if (p.title) body.title = p.title;
      return {
        path: "/calendars/events/appointments",
        version: GHL_VERSION_CALENDARS,
        body,
        summary: (loc) => `Appointment booked on ${loc}'s calendar.`,
      };
    }
  }
}

// Permissive success schema: each write returns its created object under a different key
// (contact / conversationId+messageId / id). The executor reports the raw object; callers that
// need a specific field read it off data.
const WriteResponseSchema = z.record(z.string(), z.unknown());

/**
 * Execute an APPROVED GHL write (connector registry branch). Order of gates:
 *   1. action name + payload shape (Zod)
 *   2. entitlement — tier or active Project Pass, re-resolved now, not at staging time
 *   3. multi-tenant — payload.locationId must be one of THIS owner's synced locations
 *   4. token lifecycle — fresh agency token, minted location token
 * Every terminal outcome writes a pa_ghl_action_log row; the GHL call itself writes the
 * pa_cost_events usage row.
 */
export async function executeGhlAction(input: ExecuteGhlActionInput): Promise<GhlExecuteResult> {
  if (!isGhlActionName(input.action)) {
    return { ok: false, status: 400, error: `Unknown GHL action: ${input.action}` };
  }
  const parsed = PAYLOAD_SCHEMAS[input.action].safeParse(input.payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      error: `GHL ${input.action} payload invalid: ${parsed.error.issues[0]?.message}`,
    };
  }
  const payload = parsed.data as Record<string, unknown> & { locationId: string };
  const call = endpointFor(input.action, payload);

  const logBlocked = async (error: string): Promise<void> =>
    insertGhlActionLog({
      ownerId: input.userId,
      inboxItemId: null,
      action: input.action,
      ghlLocationId: payload.locationId,
      endpoint: call.path,
      payloadHash: payloadHash(payload),
      status: "blocked",
      error,
      latencyMs: null,
    });

  const access = await resolveGhlAccess(input.userId);
  if (!access.allowed) {
    await logBlocked("no GHL entitlement (tier below Pro+ and no active Project Pass)");
    return {
      ok: false,
      status: 403,
      error:
        "The GHL Connector isn't on this plan. Pro+ includes it (3 clients) — or a 7-day GHL Project Pass runs one client.",
    };
  }

  const location = await fetchSyncedLocation(input.userId, payload.locationId);
  if (!location.ok) {
    await logBlocked(`location lookup failed: ${location.error}`);
    return { ok: false, status: location.status, error: location.error };
  }
  if (!location.data) {
    await logBlocked("locationId not in this owner's synced client registry");
    return {
      ok: false,
      status: 403,
      error:
        "That client sub-account isn't in your synced list. Sync your clients on the GHL page — if it shows as over your plan's cap, the upgrade math is there too.",
    };
  }

  const connRes = await fetchGhlConnectionFull(input.userId);
  if (!connRes.ok || !connRes.data || connRes.data.status === "revoked") {
    await logBlocked("no active GHL connection");
    return { ok: false, status: 404, error: "No active GHL connection. Reconnect on the GHL page." };
  }
  const conn = connRes.data;

  const agencyToken = await ensureFreshAgencyToken(conn);
  if (!agencyToken.ok) {
    await logBlocked(`agency token: ${agencyToken.error}`);
    return {
      ok: false,
      status: agencyToken.status,
      error: agencyToken.authError
        ? "The GHL connection needs to be reconnected — the stored authorization expired."
        : agencyToken.error,
    };
  }

  const locationToken = await mintLocationToken(
    agencyToken.data,
    conn.agency_company_id ?? "",
    payload.locationId,
  );
  if (!locationToken.ok) {
    await logBlocked(`location token: ${locationToken.error}`);
    return { ok: false, status: locationToken.status, error: locationToken.error };
  }

  const startedAt = Date.now();
  const res = await ghlApiCall(
    {
      path: call.path,
      method: "POST",
      accessToken: locationToken.data,
      version: call.version,
      body: call.body,
      ownerId: input.userId,
      idempotencyKey: `ghl:exec:${input.requestId ?? payloadHash(payload)}`,
      locationId: payload.locationId,
      entitlementSource: access.source === "project_pass" ? "project_pass" : undefined,
    },
    WriteResponseSchema,
  );
  const latencyMs = Date.now() - startedAt;

  await insertGhlActionLog({
    ownerId: input.userId,
    inboxItemId: null,
    action: input.action,
    ghlLocationId: payload.locationId,
    endpoint: call.path,
    payloadHash: payloadHash(payload),
    status: res.ok ? "executed" : "failed",
    error: res.ok ? null : res.error.slice(0, 500),
    latencyMs,
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: res.authError
        ? "GHL rejected the connector's authorization — reconnect on the GHL page."
        : `GHL ${input.action} failed (${res.status}): ${res.error.slice(0, 300)}`,
    };
  }
  return { ok: true, summary: call.summary(location.data.name), data: res.data };
}
