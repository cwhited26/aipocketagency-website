// Pure-function unit tests for the Slack connector — no network, no DB. Exercises the action
// schemas, dry-run summaries (the approval-card renderer), the registry classification, the
// drafter's refuse-on-missing-context behavior, and the rate-cap decision.

import { describe, expect, it } from "vitest";
import {
  SLACK_ACTIONS,
  SLACK_READ_ACTIONS,
  SLACK_WRITE_ACTIONS,
  getSlackAction,
  postMessageAction,
  postInThreadAction,
  sendDmAction,
  listChannelsAction,
} from "../index";
import { buildThreadReplyDraft, SlackDraftContextError } from "../draft";
import { rateCapExceeded, slackMaxSendsPerMin } from "../execute";

describe("registry", () => {
  it("exposes all five actions", () => {
    expect(SLACK_ACTIONS.map((a) => a.name).sort()).toEqual([
      "list_channels",
      "list_recent_messages",
      "post_in_thread",
      "post_message",
      "send_dm",
    ]);
  });

  it("classifies writes (gated) and reads (auto-approve eligible)", () => {
    expect([...SLACK_WRITE_ACTIONS].sort()).toEqual(["post_in_thread", "post_message", "send_dm"]);
    expect([...SLACK_READ_ACTIONS].sort()).toEqual(["list_channels", "list_recent_messages"]);
  });

  it("every descriptor carries a dryRun renderer (roadmap §3.6 enforcement)", () => {
    for (const a of SLACK_ACTIONS) {
      expect(typeof a.dryRunFromPayload).toBe("function");
    }
  });

  it("getSlackAction resolves by name and rejects unknown", () => {
    expect(getSlackAction("post_message")?.name).toBe("post_message");
    expect(getSlackAction("nope")).toBeUndefined();
  });
});

describe("schemas + dry-run", () => {
  it("post_message requires channel + text", () => {
    expect(postMessageAction.inputSchema.safeParse({ text: "hi" }).success).toBe(false);
    expect(postMessageAction.inputSchema.safeParse({ channel: "#g", text: "hi" }).success).toBe(true);
  });

  it("post_in_thread refuses without thread_ts (clear message)", () => {
    const parsed = postInThreadAction.inputSchema.safeParse({ channel: "C1", text: "hi" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "thread_ts")).toBe(true);
    }
  });

  it("send_dm requires a user_id", () => {
    expect(sendDmAction.inputSchema.safeParse({ text: "hi" }).success).toBe(false);
    expect(sendDmAction.inputSchema.safeParse({ user_id: "U1", text: "hi" }).success).toBe(true);
  });

  it("dry-run summary truncates long bodies", () => {
    const long = "x".repeat(400);
    const summary = postMessageAction.dryRunSummary({ channel: "#g", text: long });
    expect(summary).toContain("#g");
    expect(summary).toContain("…");
  });

  it("list_channels applies defaults", () => {
    const parsed = listChannelsAction.inputSchema.parse({});
    expect(parsed.limit).toBe(200);
    expect(parsed.exclude_archived).toBe(true);
  });
});

describe("drafter (req #7)", () => {
  it("builds a post_in_thread payload from a full source surface", () => {
    const draft = buildThreadReplyDraft({ channel: "C1", thread_ts: "123.45" }, "reply");
    expect(draft.action).toBe("post_in_thread");
    expect(draft.payload).toEqual({ channel: "C1", thread_ts: "123.45", text: "reply" });
  });

  it("refuses when the channel is missing", () => {
    expect(() => buildThreadReplyDraft({ thread_ts: "123.45" }, "x")).toThrow(SlackDraftContextError);
  });

  it("refuses when the thread_ts is missing", () => {
    expect(() => buildThreadReplyDraft({ channel: "C1" }, "x")).toThrow(SlackDraftContextError);
  });
});

describe("rate cap (req #8)", () => {
  it("blocks once recent writes reach the cap", () => {
    expect(rateCapExceeded(29, 30)).toBe(false);
    expect(rateCapExceeded(30, 30)).toBe(true);
    expect(rateCapExceeded(31, 30)).toBe(true);
  });

  it("defaults to 30/min when unset or invalid", () => {
    const prev = process.env.PA_SLACK_MAX_SENDS_PER_MIN;
    delete process.env.PA_SLACK_MAX_SENDS_PER_MIN;
    expect(slackMaxSendsPerMin()).toBe(30);
    process.env.PA_SLACK_MAX_SENDS_PER_MIN = "0";
    expect(slackMaxSendsPerMin()).toBe(30);
    process.env.PA_SLACK_MAX_SENDS_PER_MIN = "5";
    expect(slackMaxSendsPerMin()).toBe(5);
    if (prev === undefined) delete process.env.PA_SLACK_MAX_SENDS_PER_MIN;
    else process.env.PA_SLACK_MAX_SENDS_PER_MIN = prev;
  });
});
