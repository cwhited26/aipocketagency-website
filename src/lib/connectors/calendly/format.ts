// connectors/calendly/format.ts — pure formatting + projection helpers shared by the action
// dry-run summaries, the read endpoints, and the drafter. No network, no DB — unit-testable in
// isolation.

import type { CalendlyEventType, CalendlyScheduledEvent, CalendlyInvitee } from "./api";

/** Minutes → "30 min" / "1 hr" / "1 hr 30 min" for event-type labels. */
export function durationLabel(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

/** The last path segment of a Calendly resource URI — a short id for logs/cards. */
export function uriId(uri: string): string {
  const trimmed = uri.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

// ─── UI-safe projections ──────────────────────────────────────────────────────

export type ProjectedEventType = {
  uri: string;
  name: string;
  active: boolean;
  duration: number | null;
  schedulingUrl: string | null;
};

export function projectEventType(e: CalendlyEventType): ProjectedEventType {
  return {
    uri: e.uri,
    name: e.name ?? "(untitled meeting type)",
    active: e.active ?? false,
    duration: e.duration ?? null,
    schedulingUrl: e.scheduling_url ?? null,
  };
}

export type ProjectedScheduledEvent = {
  uri: string;
  name: string;
  status: string | null;
  start: string | null;
  end: string | null;
  location: string | null;
  inviteeCount: number;
};

export function projectScheduledEvent(e: CalendlyScheduledEvent): ProjectedScheduledEvent {
  const loc = e.location?.location ?? e.location?.type ?? null;
  return {
    uri: e.uri,
    name: e.name ?? "(untitled event)",
    status: e.status ?? null,
    start: e.start_time ?? null,
    end: e.end_time ?? null,
    location: loc,
    inviteeCount: e.invitees_counter?.total ?? 0,
  };
}

export type ProjectedInvitee = {
  uri: string;
  name: string;
  email: string | null;
  status: string | null;
  createdAt: string | null;
};

export function projectInvitee(i: CalendlyInvitee): ProjectedInvitee {
  return {
    uri: i.uri,
    name: i.name ?? "(no name)",
    email: i.email ?? null,
    status: i.status ?? null,
    createdAt: i.created_at ?? null,
  };
}
