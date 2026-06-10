// Tests for the Slack adapter's inbound classification (PA-CHAN-1/4/5) — no network. Covers the
// signature gate, the url_verification challenge, DM + @mention → ChannelMessage (untrusted_origin
// always set), and the ignore paths that keep the bot from answering itself.

import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { readSlackInbound, stripLeadingMention } from "../adapter";
import type { ParseInboundContext } from "@/lib/channels/types";

const SECRET = "8f742c6c5d1b4a3e9f0a1b2c3d4e5f60";

beforeAll(() => {
  process.env.SLACK_SIGNING_SECRET = SECRET;
});

const NOW = 1_700_000_000;

function ctx(payload: unknown): ParseInboundContext {
  const rawBody = JSON.stringify(payload);
  const sig =
    "v0=" + crypto.createHmac("sha256", SECRET).update(`v0:${NOW}:${rawBody}`).digest("hex");
  const headers = new Headers({
    "x-slack-request-timestamp": String(NOW),
    "x-slack-signature": sig,
  });
  return { rawBody, headers, nowSeconds: NOW };
}

describe("readSlackInbound", () => {
  it("returns unsigned for a forged signature (never parses the body)", () => {
    const rawBody = JSON.stringify({ type: "url_verification", challenge: "abc" });
    const headers = new Headers({
      "x-slack-request-timestamp": String(NOW),
      "x-slack-signature": "v0=bad",
    });
    const res = readSlackInbound({ rawBody, headers, nowSeconds: NOW });
    expect(res.kind).toBe("unsigned");
  });

  it("echoes a url_verification challenge", () => {
    const res = readSlackInbound(ctx({ type: "url_verification", challenge: "c-123" }));
    expect(res).toEqual({ kind: "challenge", challenge: "c-123" });
  });

  it("parses a DM to the bot into an untrusted ChannelMessage", () => {
    const res = readSlackInbound(
      ctx({
        type: "event_callback",
        team_id: "T1",
        event: { type: "message", channel_type: "im", user: "U9", channel: "D1", text: "hi there" },
      }),
    );
    expect(res.kind).toBe("message");
    if (res.kind !== "message") throw new Error("expected message");
    expect(res.message.externalId).toBe("T1:U9");
    expect(res.message.body).toBe("hi there");
    expect(res.message.untrustedOrigin).toBe(true);
    expect(res.message.channelMeta).toMatchObject({ channel: "D1", surface: "im", threadTs: null });
  });

  it("parses an @mention, stripping the mention token and threading the reply", () => {
    const res = readSlackInbound(
      ctx({
        type: "event_callback",
        team_id: "T1",
        event: {
          type: "app_mention",
          user: "U9",
          channel: "C5",
          text: "<@U000BOT> what's our refund policy?",
          ts: "111.222",
        },
      }),
    );
    expect(res.kind).toBe("message");
    if (res.kind !== "message") throw new Error("expected message");
    expect(res.message.body).toBe("what's our refund policy?");
    expect(res.message.channelMeta).toMatchObject({ channel: "C5", surface: "channel", threadTs: "111.222" });
  });

  it("ignores our own bot echo", () => {
    const res = readSlackInbound(
      ctx({
        type: "event_callback",
        event: { type: "message", channel_type: "im", user: "U9", channel: "D1", text: "echo", bot_id: "B1" },
      }),
    );
    expect(res).toEqual({ kind: "ignore", reason: "bot_message" });
  });

  it("ignores a non-DM message without an @mention", () => {
    const res = readSlackInbound(
      ctx({
        type: "event_callback",
        event: { type: "message", channel_type: "channel", user: "U9", channel: "C5", text: "chatter" },
      }),
    );
    expect(res).toEqual({ kind: "ignore", reason: "non_im_message" });
  });

  it("ignores message edits (subtype)", () => {
    const res = readSlackInbound(
      ctx({
        type: "event_callback",
        event: { type: "message", channel_type: "im", user: "U9", channel: "D1", text: "x", subtype: "message_changed" },
      }),
    );
    expect(res).toEqual({ kind: "ignore", reason: "subtype:message_changed" });
  });
});

describe("stripLeadingMention", () => {
  it("removes a leading <@id> token", () => {
    expect(stripLeadingMention("<@U123> hello")).toBe("hello");
  });
  it("leaves text without a mention untouched", () => {
    expect(stripLeadingMention("just text")).toBe("just text");
  });
});
