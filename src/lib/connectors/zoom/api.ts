// connectors/zoom/api.ts — Zoom API v2 REST client (direct fetch, no SDK).
//
// Every call authenticates with the owner's OAuth access token as the Bearer credential. The
// action modules build the request bodies (pure) and call these; only these functions touch the
// network. Responses are validated with Zod at the boundary, so nothing downstream sees `any`.
//
// Meeting-scoped reads/writes (get/update/delete) use /meetings/{meetingId}; user-scoped
// reads/writes (list/create) use /users/{userId}/meetings — the userId is the owner's zoom_user_id
// (stored at connect time), or "me" as a fallback the executor never relies on.

import { z } from "zod";

const BASE = "https://api.zoom.us/v2";

export type ZoomApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

// 401/403 (revoked/expired token) means the connection is dead and the owner must reconnect.
function isAuthFailure(status: number, body: string): boolean {
  return status === 401 || status === 403 || body.includes("invalid access token");
}

// Zoom's error envelope: { code, message }. Pull the human message out.
const ErrorEnvelopeSchema = z.object({
  code: z.number().optional(),
  message: z.string().optional(),
});

function extractError(text: string, status: number): string {
  try {
    const parsed = ErrorEnvelopeSchema.safeParse(JSON.parse(text));
    const msg = parsed.success ? parsed.data.message : undefined;
    return msg ?? `Zoom request failed (${status})`;
  } catch {
    return `Zoom request failed (${status})`;
  }
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<ZoomApiResult<T>> {
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: extractError(text, res.status),
      authError: isAuthFailure(res.status, text),
    };
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 502, error: "Zoom returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "Zoom response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

// A 204 No Content write (PATCH/DELETE) has no body to parse — succeed or surface the error.
async function expectNoContent(res: Response): Promise<ZoomApiResult<void>> {
  if (res.ok) return { ok: true, data: undefined };
  const text = await res.text();
  return {
    ok: false,
    status: res.status,
    error: extractError(text, res.status),
    authError: isAuthFailure(res.status, text),
  };
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

// ─── Response shapes (the subset each action reads) ──────────────────────────────

// Zoom returns meeting ids as numbers in some payloads and strings in others — coerce to string
// so the connector has one stable id type downstream.
const MeetingIdSchema = z.union([z.number(), z.string()]).transform((v) => String(v));

export const MeetingSchema = z.object({
  id: MeetingIdSchema,
  topic: z.string().optional(),
  start_time: z.string().optional(),
  duration: z.number().optional(),
  timezone: z.string().optional(),
  agenda: z.string().optional(),
  join_url: z.string().optional(),
  start_url: z.string().optional(),
});
export type ZoomMeeting = z.infer<typeof MeetingSchema>;

const MeetingListSchema = z.object({
  meetings: z.array(MeetingSchema).optional(),
  next_page_token: z.string().optional(),
});

// ─── Write body shapes (built by the action modules) ─────────────────────────────

export type MeetingWriteBody = {
  topic?: string;
  type?: number; // 2 = scheduled meeting
  start_time?: string; // ISO 8601, e.g. 2026-06-12T15:00:00Z
  duration?: number; // minutes
  timezone?: string; // IANA tz
  agenda?: string;
  settings?: {
    auto_recording?: "none" | "local" | "cloud";
  };
};

// ─── users/{userId}/meetings — list (read) ───────────────────────────────────────

export async function listMeetings(
  accessToken: string,
  params: { userId: string; type: "upcoming" | "scheduled"; pageSize: number },
): Promise<ZoomApiResult<ZoomMeeting[]>> {
  const url = new URL(`${BASE}/users/${encodeURIComponent(params.userId)}/meetings`);
  url.searchParams.set("type", params.type);
  url.searchParams.set("page_size", String(params.pageSize));
  const res = await fetch(url.toString(), { headers: authHeaders(accessToken), cache: "no-store" });
  const parsed = await parseJson(res, MeetingListSchema);
  if (!parsed.ok) return parsed;
  return { ok: true, data: parsed.data.meetings ?? [] };
}

// ─── users/{userId}/meetings — create (write) ────────────────────────────────────

export async function createMeeting(
  accessToken: string,
  params: { userId: string; body: MeetingWriteBody },
): Promise<ZoomApiResult<ZoomMeeting>> {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(params.userId)}/meetings`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
    cache: "no-store",
  });
  return parseJson(res, MeetingSchema);
}

// ─── meetings/{meetingId} — get (read) ───────────────────────────────────────────

export async function getMeeting(
  accessToken: string,
  meetingId: string,
): Promise<ZoomApiResult<ZoomMeeting>> {
  const res = await fetch(`${BASE}/meetings/${encodeURIComponent(meetingId)}`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  return parseJson(res, MeetingSchema);
}

// ─── meetings/{meetingId} — update (write, 204) ──────────────────────────────────

export async function updateMeeting(
  accessToken: string,
  params: { meetingId: string; body: MeetingWriteBody },
): Promise<ZoomApiResult<void>> {
  const res = await fetch(`${BASE}/meetings/${encodeURIComponent(params.meetingId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
    cache: "no-store",
  });
  return expectNoContent(res);
}

// ─── meetings/{meetingId} — delete/cancel (write, 204) ───────────────────────────
// cancel_meeting_reminder=true emails the registrants/attendees that the meeting was canceled.

export async function deleteMeeting(
  accessToken: string,
  params: { meetingId: string; notifyAttendees: boolean },
): Promise<ZoomApiResult<void>> {
  const url = new URL(`${BASE}/meetings/${encodeURIComponent(params.meetingId)}`);
  url.searchParams.set("cancel_meeting_reminder", params.notifyAttendees ? "true" : "false");
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  return expectNoContent(res);
}
