// Registry invariants for the workshop player (PA-POS-38). These three files are Chase-tunable
// data; the tests pin the contract the player depends on: ascending triggers, valid kinds, the
// kind → endpoint mapping, and the voice gate on the seeded chat.

import { describe, expect, it } from "vitest";
import { WORKSHOP_CHAT_SCRIPT } from "../chat-script";
import { WORKSHOP_WORKBOOK_MAP } from "../workbook-map";
import { WORKSHOP_ACTION_SCRIPT, WORKSHOP_ZONES } from "../action-script";
import {
  actionTarget,
  claudeConnectUrl,
  currentWorkbookPage,
  dueChatMessages,
  visibleActions,
} from "@/lib/workshop/live";

const WORKSHOP_LENGTH_SEC = 3600;

describe("chat script", () => {
  it("seeds at least 30 live messages across the 60-minute timeline", () => {
    const live = WORKSHOP_CHAT_SCRIPT.filter((m) => m.segment === "live");
    expect(live.length).toBeGreaterThanOrEqual(30);
    expect(live[0]!.trigger_sec).toBeLessThan(300);
    expect(live[live.length - 1]!.trigger_sec).toBeGreaterThan(3000);
  });

  it("keeps trigger_sec ascending within each segment and inside the video", () => {
    for (const segment of ["pre_show", "live"] as const) {
      const msgs = WORKSHOP_CHAT_SCRIPT.filter((m) => m.segment === segment);
      for (let i = 1; i < msgs.length; i++) {
        expect(msgs[i]!.trigger_sec).toBeGreaterThanOrEqual(msgs[i - 1]!.trigger_sec);
      }
      for (const m of msgs) {
        expect(m.trigger_sec).toBeGreaterThanOrEqual(0);
        expect(m.trigger_sec).toBeLessThanOrEqual(WORKSHOP_LENGTH_SEC);
      }
    }
  });

  it("keeps slop and hype out of the seeded messages", () => {
    const banned = /\b(leverage|unlock|empower|seamless|revolutionary|elevate|robust|game.?changer|mind.?blown)\b/i;
    for (const m of WORKSHOP_CHAT_SCRIPT) {
      expect(m.message).not.toMatch(banned);
      expect(m.message).not.toMatch(/!{2,}/);
      expect(m.attendee_name.length).toBeGreaterThan(0);
      expect(m.avatar_seed.length).toBeGreaterThan(0);
    }
  });

  it("fires messages exactly when the position crosses their trigger", () => {
    // The example seeded at 720 (Marcus C.) must be absent at 719 and present at 720.
    const before = dueChatMessages("live", 719);
    const after = dueChatMessages("live", 720);
    expect(before.some((m) => m.trigger_sec === 720)).toBe(false);
    expect(after.some((m) => m.trigger_sec === 720)).toBe(true);
    // And the feed only ever grows with the position.
    expect(after.length).toBeGreaterThan(before.length - 1);
    expect(dueChatMessages("live", WORKSHOP_LENGTH_SEC).length).toBe(
      WORKSHOP_CHAT_SCRIPT.filter((m) => m.segment === "live").length,
    );
  });

  it("keeps pre-show messages out of the live feed", () => {
    const live = dueChatMessages("live", WORKSHOP_LENGTH_SEC);
    expect(live.every((m) => m.segment === "live")).toBe(true);
  });
});

describe("workbook map", () => {
  it("is ascending and stays within the 15-page workbook", () => {
    for (let i = 1; i < WORKSHOP_WORKBOOK_MAP.length; i++) {
      expect(WORKSHOP_WORKBOOK_MAP[i]!.trigger_sec).toBeGreaterThan(
        WORKSHOP_WORKBOOK_MAP[i - 1]!.trigger_sec,
      );
    }
    for (const e of WORKSHOP_WORKBOOK_MAP) {
      expect(e.page_number).toBeGreaterThanOrEqual(1);
      expect(e.page_number).toBeLessThanOrEqual(15);
    }
    expect(WORKSHOP_WORKBOOK_MAP.length).toBeGreaterThanOrEqual(10);
  });

  it("resolves the current page from the video position", () => {
    expect(currentWorkbookPage(0)).toBe(1);
    expect(currentWorkbookPage(1250)).toBe(5); // voice zone section
    expect(currentWorkbookPage(WORKSHOP_LENGTH_SEC)).toBe(15);
  });
});

describe("action script", () => {
  it("covers the §24.4 arc: fork, five zones, Claude connect, PA login", () => {
    const kinds = WORKSHOP_ACTION_SCRIPT.map((a) => a.kind);
    expect(kinds.filter((k) => k === "fork_repo")).toHaveLength(1);
    expect(kinds.filter((k) => k === "add_zone")).toHaveLength(5);
    expect(kinds.filter((k) => k === "connect_claude")).toHaveLength(1);
    expect(kinds.filter((k) => k === "login_to_pa")).toHaveLength(1);
    const zones = WORKSHOP_ACTION_SCRIPT.filter((a) => a.kind === "add_zone").map(
      (a) => a.payload?.zone,
    );
    expect(zones).toEqual([...WORKSHOP_ZONES]);
  });

  it("is ascending, with the fork before every zone write", () => {
    for (let i = 1; i < WORKSHOP_ACTION_SCRIPT.length; i++) {
      expect(WORKSHOP_ACTION_SCRIPT[i]!.trigger_sec).toBeGreaterThan(
        WORKSHOP_ACTION_SCRIPT[i - 1]!.trigger_sec,
      );
    }
    const fork = WORKSHOP_ACTION_SCRIPT.find((a) => a.kind === "fork_repo")!;
    for (const zone of WORKSHOP_ACTION_SCRIPT.filter((a) => a.kind === "add_zone")) {
      expect(zone.trigger_sec).toBeGreaterThan(fork.trigger_sec);
    }
  });

  it("appears exactly when the position crosses the trigger", () => {
    expect(visibleActions(899).some((a) => a.kind === "fork_repo")).toBe(false);
    expect(visibleActions(900).some((a) => a.kind === "fork_repo")).toBe(true);
    expect(visibleActions(WORKSHOP_LENGTH_SEC)).toHaveLength(WORKSHOP_ACTION_SCRIPT.length);
  });

  it("drives the correct API call or navigation per kind", () => {
    expect(actionTarget("fork_repo")).toEqual({
      type: "api",
      endpoint: "/api/workshop/actions/fork-repo",
    });
    expect(actionTarget("add_zone")).toEqual({
      type: "api",
      endpoint: "/api/workshop/actions/add-zone",
    });
    expect(actionTarget("connect_claude")).toEqual({ type: "navigate", hrefKind: "claude" });
    expect(actionTarget("login_to_pa")).toEqual({ type: "navigate", hrefKind: "app" });
  });

  it("pre-fills the forked repo in the Claude link", () => {
    const url = claudeConnectUrl("https://github.com/someone/business-brain");
    expect(url).toContain("claude.ai");
    expect(url).toContain(encodeURIComponent("https://github.com/someone/business-brain"));
  });
});
