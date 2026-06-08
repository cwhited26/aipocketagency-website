// connectors/calendly/api.ts — Calendly API v2 REST client (direct fetch, no SDK).
// Every response is validated with Zod at the boundary. The action modules build the request
// params/bodies (pure) and call these; only these functions touch the network.

import { z } from "zod";
import type { CalendlyResult } from "./types";

const BASE = "https://api.calendly.com";

function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<CalendlyResult<T>> {
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: text,
      authError: isAuthFailure(res.status, text),
    };
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 502, error: "calendly returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "calendly response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

function authGet(accessToken: string): RequestInit {
  return {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  };
}

function authPost(accessToken: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  };
}

// ─── User resource (organization lookup) ────────────────────────────────────────
// list_scheduled_events is scoped by (user, organization); the org URI lives on the user
// resource. We derive it from the stored user URI rather than persisting a second column.

const UserResourceSchema = z.object({
  resource: z.object({
    uri: z.string(),
    current_organization: z.string().optional(),
    scheduling_url: z.string().optional(),
  }),
});

export async function getUserOrganization(
  accessToken: string,
  userUri: string,
): Promise<CalendlyResult<string | null>> {
  const res = await fetch(userUri, authGet(accessToken));
  const parsed = await parseJson(res, UserResourceSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.resource.current_organization ?? null };
}

// ─── Event types (GET /event_types?user=) ────────────────────────────────────────

const EventTypeSchema = z.object({
  uri: z.string(),
  name: z.string().nullable().optional(),
  active: z.boolean().optional(),
  slug: z.string().nullable().optional(),
  scheduling_url: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  kind: z.string().nullable().optional(),
});
export type CalendlyEventType = z.infer<typeof EventTypeSchema>;

const EventTypeListSchema = z.object({
  collection: z.array(EventTypeSchema).optional(),
});

export async function listEventTypes(
  accessToken: string,
  params: { userUri: string; count: number },
): Promise<CalendlyResult<CalendlyEventType[]>> {
  const url = new URL(`${BASE}/event_types`);
  url.searchParams.set("user", params.userUri);
  url.searchParams.set("count", String(params.count));
  const res = await fetch(url.toString(), authGet(accessToken));
  const parsed = await parseJson(res, EventTypeListSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.collection ?? [] };
}

// ─── Scheduled events (GET /scheduled_events?user=&organization=) ─────────────────

const ScheduledEventSchema = z.object({
  uri: z.string(),
  name: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  location: z
    .object({ type: z.string().optional(), location: z.string().nullable().optional() })
    .nullable()
    .optional(),
  invitees_counter: z
    .object({ total: z.number().optional(), active: z.number().optional() })
    .nullable()
    .optional(),
});
export type CalendlyScheduledEvent = z.infer<typeof ScheduledEventSchema>;

const ScheduledEventListSchema = z.object({
  collection: z.array(ScheduledEventSchema).optional(),
});

export async function listScheduledEvents(
  accessToken: string,
  params: {
    userUri: string;
    organizationUri: string;
    count: number;
    status?: "active" | "canceled";
    minStartTime?: string;
    maxStartTime?: string;
  },
): Promise<CalendlyResult<CalendlyScheduledEvent[]>> {
  const url = new URL(`${BASE}/scheduled_events`);
  url.searchParams.set("organization", params.organizationUri);
  url.searchParams.set("user", params.userUri);
  url.searchParams.set("count", String(params.count));
  url.searchParams.set("sort", "start_time:asc");
  if (params.status) url.searchParams.set("status", params.status);
  if (params.minStartTime) url.searchParams.set("min_start_time", params.minStartTime);
  if (params.maxStartTime) url.searchParams.set("max_start_time", params.maxStartTime);
  const res = await fetch(url.toString(), authGet(accessToken));
  const parsed = await parseJson(res, ScheduledEventListSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.collection ?? [] };
}

// ─── Invitees of a scheduled event (GET /scheduled_events/<uuid>/invitees) ─────────

const InviteeSchema = z.object({
  uri: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type CalendlyInvitee = z.infer<typeof InviteeSchema>;

const InviteeListSchema = z.object({
  collection: z.array(InviteeSchema).optional(),
});

export async function listInvitees(
  accessToken: string,
  params: { eventUri: string; count: number },
): Promise<CalendlyResult<CalendlyInvitee[]>> {
  // The invitees endpoint hangs off the event resource URI: <eventUri>/invitees.
  const url = new URL(`${params.eventUri.replace(/\/+$/, "")}/invitees`);
  url.searchParams.set("count", String(params.count));
  const res = await fetch(url.toString(), authGet(accessToken));
  const parsed = await parseJson(res, InviteeListSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.collection ?? [] };
}

// ─── One-off scheduling link (POST /scheduling_links) ─────────────────────────────

const SchedulingLinkSchema = z.object({
  resource: z.object({
    booking_url: z.string(),
    owner: z.string().optional(),
    owner_type: z.string().optional(),
  }),
});

export async function createSchedulingLink(
  accessToken: string,
  params: { eventTypeUri: string; maxEventCount: number },
): Promise<CalendlyResult<{ bookingUrl: string }>> {
  const body = {
    max_event_count: params.maxEventCount,
    owner: params.eventTypeUri,
    owner_type: "EventType",
  };
  const res = await fetch(`${BASE}/scheduling_links`, authPost(accessToken, body));
  const parsed = await parseJson(res, SchedulingLinkSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: { bookingUrl: parsed.data.resource.booking_url } };
}

// ─── Cancel a scheduled event (POST /scheduled_events/<uuid>/cancellation) ─────────

const CancellationSchema = z.object({
  resource: z.object({
    canceled_by: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    canceler_type: z.string().nullable().optional(),
  }),
});

export async function cancelScheduledEvent(
  accessToken: string,
  params: { eventUri: string; reason?: string },
): Promise<CalendlyResult<{ reason: string | null }>> {
  const body: Record<string, unknown> = {};
  if (params.reason) body.reason = params.reason;
  const url = `${params.eventUri.replace(/\/+$/, "")}/cancellation`;
  const res = await fetch(url, authPost(accessToken, body));
  const parsed = await parseJson(res, CancellationSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: { reason: parsed.data.resource.reason ?? null } };
}
