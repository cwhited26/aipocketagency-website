// Pure-function unit tests for the inbound Slack Events surface (PA-SLACK-DM-1) — no network.
// Covers signature verification (valid / stale / forged / missing) and event parsing (challenge,
// DM, @mention, and every ignore path that prevents the agent answering itself).

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature, parseSlackEvent, stripLeadingMention } from "../events";

const SECRET = "8f742c6c5d1b4a3e9f0a1b2c3d4e5f60";

function sign(rawBody: string, timestamp: number): string {
  return (
    "v0=" +
    crypto.createHmac("sha256", SECRET).update(`v0:${timestamp}:${rawBody}`).digest("hex")
  );
}

describe("verifySlackSignature", () => {
  const now = 1_700_000_000;
  const body = JSON.stringify({ type: "event_callback" });

  it("accepts a correctly signed, fresh request", () => {
    const ts = now;
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(ts),
      signature: sign(body, ts),
      rawBody: body,
      nowSeconds: now,
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a stale timestamp (replay window)", () => {
    const ts = now - 60 * 10; // 10 minutes old
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(ts),
      signature: sign(body, ts),
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("rejects a forged signature", () => {
    const ts = now;
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(ts),
      signature: "v0=deadbeef",
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a signature made with the wrong secret", () => {
    const ts = now;
    const wrong =
      "v0=" + crypto.createHmac("sha256", "nope").update(`v0:${ts}:${body}`).digest("hex");
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(ts),
      signature: wrong,
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects when headers are missing", () => {
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: null,
      signature: null,
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const ts = now;
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(ts),
      signature: sign(body, ts),
      rawBody: body + " ",
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });
});

describe("parseSlackEvent", () => {
  it("returns the challenge on url_verification", () => {
    const res = parseSlackEvent({ type: "url_verification", challenge: "abc123" });
    expect(res).toEqual({ kind: "challenge", challenge: "abc123" });
  });

  it("routes a DM to the bot (message + im)", () => {
    const res = parseSlackEvent({
      type: "event_callback",
      team_id: "T1",
      event: {
        type: "message",
        channel_type: "im",
        user: "U99",
        channel: "D55",
        text: "what's on my plate today?",
        ts: "1700000000.000100",
      },
    });
    expect(res).toEqual({
      kind: "message",
      surface: "im",
      slackUserId: "U99",
      teamId: "T1",
      channel: "D55",
      text: "what's on my plate today?",
      threadTs: null,
    });
  });

  it("routes an @mention, stripping the bot token and threading under it", () => {
    const res = parseSlackEvent({
      type: "event_callback",
      team_id: "T1",
      event: {
        type: "app_mention",
        user: "U99",
        channel: "C42",
        text: "<@UBOT123> draft a reply to Alan",
        ts: "1700000000.000200",
      },
    });
    expect(res).toEqual({
      kind: "message",
      surface: "channel",
      slackUserId: "U99",
      teamId: "T1",
      channel: "C42",
      text: "draft a reply to Alan",
      threadTs: "1700000000.000200",
    });
  });

  it("threads an @mention under an existing thread_ts when present", () => {
    const res = parseSlackEvent({
      type: "event_callback",
      event: {
        type: "app_mention",
        user: "U99",
        channel: "C42",
        text: "<@UBOT123> follow up",
        ts: "1700000000.000300",
        thread_ts: "1700000000.000111",
      },
    });
    expect(res.kind === "message" && res.threadTs).toBe("1700000000.000111");
  });

  it("ignores the bot's own echo (bot_id present) — no self-reply loop", () => {
    const res = parseSlackEvent({
      type: "event_callback",
      event: { type: "message", channel_type: "im", channel: "D55", bot_id: "B1", text: "hi" },
    });
    expect(res).toEqual({ kind: "ignore", reason: "bot_message" });
  });

  it("ignores message subtypes (edits, deletes, joins)", () => {
    const res = parseSlackEvent({
      type: "event_callback",
      event: { type: "message", subtype: "message_changed", channel: "D55", user: "U99" },
    });
    expect(res).toEqual({ kind: "ignore", reason: "subtype:message_changed" });
  });

  it("ignores a plain channel message with no mention", () => {
    const res = parseSlackEvent({
      type: "event_callback",
      event: { type: "message", channel_type: "channel", user: "U99", channel: "C42", text: "hey team" },
    });
    expect(res).toEqual({ kind: "ignore", reason: "non_im_message" });
  });

  it("ignores an unknown envelope", () => {
    expect(parseSlackEvent({ foo: "bar" })).toEqual({ kind: "ignore", reason: "unsupported_envelope" });
  });
});

describe("stripLeadingMention", () => {
  it("removes only a leading mention token", () => {
    expect(stripLeadingMention("<@U1> hello there")).toBe("hello there");
    expect(stripLeadingMention("no mention here")).toBe("no mention here");
    expect(stripLeadingMention("hey <@U1> in the middle")).toBe("hey <@U1> in the middle");
  });
});
