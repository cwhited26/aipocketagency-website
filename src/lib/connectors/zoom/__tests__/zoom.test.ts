// Pure-function unit tests for the Zoom connector — no network, no DB. Exercises the action
// registry + gates, the duration/id/link formatting, the dry-run renderers (approval-card text),
// the write-body builders, the rate-cap decision, the per-action trust windows (create=10,
// update/cancel=20), and the cross-connector composition field injection.

import { describe, expect, it } from "vitest";
import {
  ZOOM_ACTIONS,
  ZOOM_WRITE_ACTIONS,
  isZoomAction,
  isZoomReadOnly,
  isZoomAutoApproveEligibleByDefault,
  zoomActionGate,
  rateCapExceeded,
  zoomMaxWritesPerMin,
} from "../index";
import { durationMinutes, meetingIdToPath, withZoomLine } from "../format";
import { listUpcomingMeetingsAction } from "../actions/list_upcoming_meetings";
import { getMeetingLinkAction } from "../actions/get_meeting_link";
import { createMeetingAction, buildMeetingBody, resolveDuration } from "../actions/create_meeting";
import { updateMeetingAction, buildUpdateBody } from "../actions/update_meeting";
import { cancelMeetingAction } from "../actions/cancel_meeting";
import { applyZoomToEventFields } from "../compose";
import { autoApproveUnlockedFor, connectorActionTrustWindow } from "@/lib/orchestrator/tier-caps";

describe("registry", () => {
  it("exposes all five actions", () => {
    expect(ZOOM_ACTIONS.map((a) => a.action).sort()).toEqual([
      "cancel_meeting",
      "create_meeting",
      "get_meeting_link",
      "list_upcoming_meetings",
      "update_meeting",
    ]);
  });

  it("classifies reads vs writes", () => {
    expect([...ZOOM_WRITE_ACTIONS].sort()).toEqual([
      "cancel_meeting",
      "create_meeting",
      "update_meeting",
    ]);
    expect(isZoomReadOnly("list_upcoming_meetings")).toBe(true);
    expect(isZoomReadOnly("get_meeting_link")).toBe(true);
    expect(isZoomReadOnly("create_meeting")).toBe(false);
  });

  it("recognizes known actions and rejects unknown", () => {
    expect(isZoomAction("create_meeting")).toBe(true);
    expect(isZoomAction("delete_account")).toBe(false);
  });

  it("gates: reads=read, writes=gated", () => {
    expect(zoomActionGate("list_upcoming_meetings")).toBe("read");
    expect(zoomActionGate("get_meeting_link")).toBe("read");
    expect(zoomActionGate("create_meeting")).toBe("gated");
    expect(zoomActionGate("update_meeting")).toBe("gated");
    expect(zoomActionGate("cancel_meeting")).toBe("gated");
  });

  it("only reads are auto-approve eligible by default", () => {
    expect(isZoomAutoApproveEligibleByDefault("list_upcoming_meetings")).toBe(true);
    expect(isZoomAutoApproveEligibleByDefault("get_meeting_link")).toBe(true);
    expect(isZoomAutoApproveEligibleByDefault("create_meeting")).toBe(false);
  });
});

describe("trust windows (task item 8)", () => {
  it("create_meeting unlocks at the standard window (N=10)", () => {
    expect(connectorActionTrustWindow("zoom", "create_meeting")).toBe(10);
    expect(autoApproveUnlockedFor("zoom", "create_meeting", 9)).toBe(false);
    expect(autoApproveUnlockedFor("zoom", "create_meeting", 10)).toBe(true);
  });

  it("update_meeting + cancel_meeting stay gated longer (N=20)", () => {
    expect(connectorActionTrustWindow("zoom", "update_meeting")).toBe(20);
    expect(connectorActionTrustWindow("zoom", "cancel_meeting")).toBe(20);
    expect(autoApproveUnlockedFor("zoom", "update_meeting", 19)).toBe(false);
    expect(autoApproveUnlockedFor("zoom", "update_meeting", 20)).toBe(true);
    expect(autoApproveUnlockedFor("zoom", "cancel_meeting", 20)).toBe(true);
  });
});

describe("format helpers", () => {
  it("computes duration minutes from start/end, clamps + rejects bad input", () => {
    expect(durationMinutes("2026-06-12T15:00:00Z", "2026-06-12T15:30:00Z")).toBe(30);
    expect(durationMinutes("2026-06-12T15:00:00Z", "2026-06-12T15:00:00Z")).toBeNull(); // not after
    expect(durationMinutes("nope", "2026-06-12T15:30:00Z")).toBeNull();
  });

  it("normalizes meeting ids (number or string) to a path", () => {
    expect(meetingIdToPath(81234567890)).toBe("81234567890");
    expect(meetingIdToPath("  812 ")).toBe("812");
    expect(meetingIdToPath("")).toBeNull();
    expect(meetingIdToPath(null)).toBeNull();
  });

  it("appends a join line without duplicating it", () => {
    expect(withZoomLine("Agenda", "https://zoom.us/j/1")).toBe("Agenda\n\nJoin Zoom: https://zoom.us/j/1");
    expect(withZoomLine("has https://zoom.us/j/1 already", "https://zoom.us/j/1")).toBe(
      "has https://zoom.us/j/1 already",
    );
    expect(withZoomLine(undefined, "https://zoom.us/j/1")).toBe("Join Zoom: https://zoom.us/j/1");
  });
});

describe("create_meeting body + duration", () => {
  it("resolves an explicit duration over a derived one", () => {
    expect(
      resolveDuration({ topic: "x", start_time: "2026-06-12T15:00:00Z", duration_minutes: 45 }),
    ).toBe(45);
  });

  it("derives duration from start/end when no explicit duration", () => {
    expect(
      resolveDuration({
        topic: "x",
        start_time: "2026-06-12T15:00:00Z",
        end_time: "2026-06-12T16:00:00Z",
      }),
    ).toBe(60);
  });

  it("builds a scheduled-meeting body with recording when asked", () => {
    const body = buildMeetingBody({
      topic: "Roof walkthrough",
      start_time: "2026-06-12T15:00:00Z",
      duration_minutes: 30,
      auto_recording: "cloud",
    });
    expect(body.type).toBe(2);
    expect(body.topic).toBe("Roof walkthrough");
    expect(body.duration).toBe(30);
    expect(body.settings?.auto_recording).toBe("cloud");
  });
});

describe("update_meeting body", () => {
  it("only includes changed fields", () => {
    const body = buildUpdateBody({ meeting_id: "1", topic: "New name" });
    expect(body).toEqual({ topic: "New name" });
  });

  it("derives duration from a start/end pair on reschedule", () => {
    const body = buildUpdateBody({
      meeting_id: "1",
      start_time: "2026-06-12T15:00:00Z",
      end_time: "2026-06-12T15:45:00Z",
    });
    expect(body.duration).toBe(45);
  });
});

describe("dry-run renderers (approval-card text)", () => {
  it("every action carries a dryRunSummary function", () => {
    for (const a of [
      listUpcomingMeetingsAction,
      getMeetingLinkAction,
      createMeetingAction,
      updateMeetingAction,
      cancelMeetingAction,
    ]) {
      expect(typeof a.dryRunSummary).toBe("function");
    }
  });

  it("create_meeting surfaces topic + duration", () => {
    const text = createMeetingAction.dryRunSummary({
      topic: "Discovery call",
      start_time: "2026-06-12T15:00:00Z",
      duration_minutes: 30,
    });
    expect(text).toContain("Discovery call");
    expect(text).toContain("30 min");
  });

  it("cancel_meeting warns attendees are notified by default", () => {
    const text = cancelMeetingAction.dryRunSummary({ meeting_id: "99" });
    expect(text).toContain("99");
    expect(text.toLowerCase()).toContain("emailed");
  });
});

describe("cross-connector composition (task item 6)", () => {
  it("injects the join link into description + sets location when empty", () => {
    const fields = applyZoomToEventFields({ description: "Quote review" }, "https://zoom.us/j/42");
    expect(fields.description).toContain("Join Zoom: https://zoom.us/j/42");
    expect(fields.location).toBe("https://zoom.us/j/42");
  });

  it("keeps a physical location when one is already set", () => {
    const fields = applyZoomToEventFields(
      { description: "Site visit", location: "123 Main St" },
      "https://zoom.us/j/42",
    );
    expect(fields.location).toBe("123 Main St");
    expect(fields.description).toContain("https://zoom.us/j/42");
  });
});

describe("write rate cap", () => {
  it("blocks once recent writes reach the cap", () => {
    expect(rateCapExceeded(19, 20)).toBe(false);
    expect(rateCapExceeded(20, 20)).toBe(true);
  });

  it("default cap is a positive number", () => {
    expect(zoomMaxWritesPerMin()).toBeGreaterThan(0);
  });
});
