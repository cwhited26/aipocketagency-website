// Pure-function unit tests for the Calendly connector — no network, no DB. Exercises the action
// schemas, dry-run summaries (the approval-card renderer), the registry classification + gates,
// the format/projection helpers, the meeting-routing drafter, and the per-action trust windows.

import { describe, expect, it } from "vitest";
import {
  CALENDLY_ACTIONS,
  CALENDLY_WRITE_ACTIONS,
  isCalendlyAction,
  isCalendlyReadOnly,
  calendlyActionGate,
} from "../index";
import { ListEventTypesInputSchema, dryRunSummary as eventTypesDryRun } from "../actions/list_event_types";
import {
  ListScheduledEventsInputSchema,
  dryRunSummary as scheduledDryRun,
} from "../actions/list_scheduled_events";
import { ListInviteesInputSchema } from "../actions/list_invitees";
import {
  CreateOneOffLinkInputSchema,
  dryRunSummary as linkDryRun,
} from "../actions/create_one_off_link";
import {
  CancelScheduledEventInputSchema,
  dryRunSummary as cancelDryRun,
} from "../actions/cancel_scheduled_event";
import { chooseMeetingRoute } from "../drafter";
import { durationLabel, uriId, projectEventType, projectScheduledEvent } from "../format";
import { hasCalendlyScope, CALENDLY_DEFAULT_SCOPE } from "../oauth";
import {
  autoApproveUnlockedFor,
  connectorActionTrustWindow,
} from "@/lib/orchestrator/tier-caps";

const EVENT_TYPE_URI = "https://api.calendly.com/event_types/ET123";
const EVENT_URI = "https://api.calendly.com/scheduled_events/EV456";

describe("registry", () => {
  it("exposes all five actions", () => {
    expect(CALENDLY_ACTIONS.map((a) => a.action).sort()).toEqual([
      "cancel_scheduled_event",
      "create_one_off_link",
      "list_event_types",
      "list_invitees",
      "list_scheduled_events",
    ]);
  });

  it("classifies reads (read gate) and writes (gated)", () => {
    expect([...CALENDLY_WRITE_ACTIONS].sort()).toEqual([
      "cancel_scheduled_event",
      "create_one_off_link",
    ]);
    expect(isCalendlyReadOnly("list_event_types")).toBe(true);
    expect(isCalendlyReadOnly("list_scheduled_events")).toBe(true);
    expect(isCalendlyReadOnly("list_invitees")).toBe(true);
    expect(isCalendlyReadOnly("create_one_off_link")).toBe(false);
    expect(calendlyActionGate("cancel_scheduled_event")).toBe("gated");
  });

  it("recognizes only known action names", () => {
    expect(isCalendlyAction("create_one_off_link")).toBe(true);
    expect(isCalendlyAction("delete_everything")).toBe(false);
  });
});

describe("schemas", () => {
  it("create_one_off_link requires a real event-type URI", () => {
    expect(CreateOneOffLinkInputSchema.safeParse({ event_type_uri: "not-a-url" }).success).toBe(false);
    const ok = CreateOneOffLinkInputSchema.safeParse({ event_type_uri: EVENT_TYPE_URI });
    expect(ok.success).toBe(true);
  });

  it("create_one_off_link caps max_event_count", () => {
    expect(
      CreateOneOffLinkInputSchema.safeParse({ event_type_uri: EVENT_TYPE_URI, max_event_count: 99 })
        .success,
    ).toBe(false);
    expect(
      CreateOneOffLinkInputSchema.safeParse({ event_type_uri: EVENT_TYPE_URI, max_event_count: 1 })
        .success,
    ).toBe(true);
  });

  it("cancel + invitees require a scheduled-event URI", () => {
    expect(CancelScheduledEventInputSchema.safeParse({ event_uri: "nope" }).success).toBe(false);
    expect(CancelScheduledEventInputSchema.safeParse({ event_uri: EVENT_URI }).success).toBe(true);
    expect(ListInviteesInputSchema.safeParse({ event_uri: EVENT_URI }).success).toBe(true);
  });

  it("list schemas accept empty input (defaults applied at execute)", () => {
    expect(ListEventTypesInputSchema.safeParse({}).success).toBe(true);
    expect(ListScheduledEventsInputSchema.safeParse({}).success).toBe(true);
    expect(ListScheduledEventsInputSchema.safeParse({ status: "bogus" }).success).toBe(false);
  });
});

describe("dry-run summaries", () => {
  it("create_one_off_link names the meeting type and flags single-use", () => {
    const s = linkDryRun({ event_type_uri: EVENT_TYPE_URI, event_type_name: "30 min intro" });
    expect(s).toContain("30 min intro");
    expect(s).toContain("Single-use");
  });

  it("cancel warns the prospect is notified", () => {
    const s = cancelDryRun({ event_uri: EVENT_URI });
    expect(s.toLowerCase()).toContain("cancellation notice");
  });

  it("read dry-runs describe the lookup", () => {
    expect(eventTypesDryRun({ active_only: true })).toContain("active only");
    expect(scheduledDryRun({})).toContain("Calendly bookings");
  });
});

describe("format helpers", () => {
  it("durationLabel renders hours + minutes", () => {
    expect(durationLabel(30)).toBe("30 min");
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(90)).toBe("1 hr 30 min");
    expect(durationLabel(null)).toBe("");
  });

  it("uriId returns the last path segment", () => {
    expect(uriId(EVENT_TYPE_URI)).toBe("ET123");
    expect(uriId(`${EVENT_URI}/`)).toBe("EV456");
  });

  it("projections supply safe fallbacks", () => {
    expect(projectEventType({ uri: EVENT_TYPE_URI }).name).toBe("(untitled meeting type)");
    const ev = projectScheduledEvent({ uri: EVENT_URI, location: { type: "zoom", location: null } });
    expect(ev.location).toBe("zoom");
    expect(ev.inviteeCount).toBe(0);
  });
});

describe("meeting-routing drafter", () => {
  it("routes an external prospect to a Calendly one-off link when Calendly is connected", () => {
    const d = chooseMeetingRoute({ hasCalendly: true, hasCalendar: true, isExternalProspect: true });
    expect(d.route).toBe("calendly_one_off_link");
  });

  it("routes an internal meeting to Google Calendar even when Calendly is connected", () => {
    const d = chooseMeetingRoute({ hasCalendly: true, hasCalendar: true, isExternalProspect: false });
    expect(d.route).toBe("calendar_create_event");
  });

  it("falls back to Calendar for an external prospect with no Calendly", () => {
    const d = chooseMeetingRoute({ hasCalendly: false, hasCalendar: true, isExternalProspect: true });
    expect(d.route).toBe("calendar_create_event");
  });
});

describe("trust ladder", () => {
  it("create_one_off_link uses the default window (10)", () => {
    expect(connectorActionTrustWindow("calendly", "create_one_off_link")).toBe(10);
    expect(autoApproveUnlockedFor("calendly", "create_one_off_link", 9)).toBe(false);
    expect(autoApproveUnlockedFor("calendly", "create_one_off_link", 10)).toBe(true);
  });

  it("cancel_scheduled_event stays gated far longer (25)", () => {
    expect(connectorActionTrustWindow("calendly", "cancel_scheduled_event")).toBe(25);
    expect(autoApproveUnlockedFor("calendly", "cancel_scheduled_event", 24)).toBe(false);
    expect(autoApproveUnlockedFor("calendly", "cancel_scheduled_event", 25)).toBe(true);
  });
});

describe("oauth scope marker", () => {
  it("hasCalendlyScope checks the default marker", () => {
    expect(hasCalendlyScope([CALENDLY_DEFAULT_SCOPE])).toBe(true);
    expect(hasCalendlyScope([])).toBe(false);
    expect(hasCalendlyScope(null)).toBe(false);
  });
});
