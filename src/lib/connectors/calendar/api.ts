// connectors/calendar/api.ts — Google Calendar v3 REST client (direct fetch, no SDK).
// Every response is validated with Zod at the boundary. The action modules build the request
// bodies (pure) and call these; only these functions touch the network.

import { z } from "zod";
import type { CalendarResult } from "./oauth";

const BASE = "https://www.googleapis.com/calendar/v3";

function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid_grant");
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<CalendarResult<T>> {
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
    return { ok: false, status: 502, error: "calendar returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "calendar response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

// ─── Shared event shapes ────────────────────────────────────────────────────────

// A point in time on an event: dateTime (RFC 3339) for timed events, date (YYYY-MM-DD) for
// all-day events. timeZone is an IANA name.
export type EventDateTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type EventAttendee = {
  email: string;
  displayName?: string;
  optional?: boolean;
  responseStatus?: string;
};

// The subset of the Calendar event resource the connector writes. conferenceData (Google Meet)
// is created via createRequest when requested; reads echo the resolved entryPoints.
export type EventWriteBody = {
  summary?: string;
  description?: string;
  location?: string;
  start?: EventDateTime;
  end?: EventDateTime;
  attendees?: EventAttendee[];
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: "hangoutsMeet" };
    };
  };
};

const EventDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
});

const EventResourceSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  htmlLink: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  hangoutLink: z.string().optional(),
  start: EventDateTimeSchema.optional(),
  end: EventDateTimeSchema.optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().optional(),
        displayName: z.string().optional(),
        responseStatus: z.string().optional(),
      }),
    )
    .optional(),
});
export type EventResource = z.infer<typeof EventResourceSchema>;

const EventListSchema = z.object({
  items: z.array(EventResourceSchema).optional(),
  nextPageToken: z.string().optional(),
});

// ─── events.list ─────────────────────────────────────────────────────────────

export async function listEvents(
  accessToken: string,
  params: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
    maxResults: number;
  },
): Promise<CalendarResult<EventResource[]>> {
  const url = new URL(`${BASE}/calendars/${encodeURIComponent(params.calendarId)}/events`);
  url.searchParams.set("timeMin", params.timeMin);
  url.searchParams.set("timeMax", params.timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(params.maxResults));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const parsed = await parseJson(res, EventListSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.items ?? [] };
}

// ─── events.insert ─────────────────────────────────────────────────────────────

export async function insertEvent(
  accessToken: string,
  params: { calendarId: string; body: EventWriteBody; sendUpdates: boolean },
): Promise<CalendarResult<EventResource>> {
  const url = new URL(`${BASE}/calendars/${encodeURIComponent(params.calendarId)}/events`);
  url.searchParams.set("sendUpdates", params.sendUpdates ? "all" : "none");
  if (params.body.conferenceData) url.searchParams.set("conferenceDataVersion", "1");
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
    cache: "no-store",
  });
  return parseJson(res, EventResourceSchema);
}

// ─── events.patch ──────────────────────────────────────────────────────────────

export async function patchEvent(
  accessToken: string,
  params: { calendarId: string; eventId: string; body: EventWriteBody; sendUpdates: boolean },
): Promise<CalendarResult<EventResource>> {
  const url = new URL(
    `${BASE}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(
      params.eventId,
    )}`,
  );
  url.searchParams.set("sendUpdates", params.sendUpdates ? "all" : "none");
  if (params.body.conferenceData) url.searchParams.set("conferenceDataVersion", "1");
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
    cache: "no-store",
  });
  return parseJson(res, EventResourceSchema);
}

// ─── events.delete (cancel) ──────────────────────────────────────────────────────

export async function deleteEvent(
  accessToken: string,
  params: { calendarId: string; eventId: string; sendUpdates: boolean },
): Promise<CalendarResult<void>> {
  const url = new URL(
    `${BASE}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(
      params.eventId,
    )}`,
  );
  url.searchParams.set("sendUpdates", params.sendUpdates ? "all" : "none");
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text, authError: isAuthFailure(res.status, text) };
  }
  return { ok: true, data: undefined };
}

// ─── freeBusy ────────────────────────────────────────────────────────────────

const FreeBusySchema = z.object({
  calendars: z.record(
    z.string(),
    z.object({
      busy: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    }),
  ),
});
export type FreeBusyResponse = z.infer<typeof FreeBusySchema>;

export async function freeBusy(
  accessToken: string,
  params: { calendarIds: string[]; timeMin: string; timeMax: string },
): Promise<CalendarResult<FreeBusyResponse>> {
  const res = await fetch(`${BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      items: params.calendarIds.map((id) => ({ id })),
    }),
    cache: "no-store",
  });
  return parseJson(res, FreeBusySchema);
}
