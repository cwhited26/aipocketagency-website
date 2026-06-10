// Tests for the Channels Gateway Slack OAuth URL builder (PA-CHAN-1) — pure, no network. Confirms
// the gateway's own callback path (distinct from the legacy Connection) and the SPEC §8.2 scopes.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHANNEL_SLACK_SCOPES,
  buildChannelSlackAuthorizeUrl,
  channelSlackRedirectUri,
} from "../oauth";

const prevBase = process.env.PA_OAUTH_REDIRECT_BASE;

beforeEach(() => {
  delete process.env.PA_OAUTH_REDIRECT_BASE;
});
afterEach(() => {
  if (prevBase === undefined) delete process.env.PA_OAUTH_REDIRECT_BASE;
  else process.env.PA_OAUTH_REDIRECT_BASE = prevBase;
});

describe("channelSlackRedirectUri", () => {
  it("defaults to the gateway's own callback on aipocketagent.com", () => {
    expect(channelSlackRedirectUri()).toBe("https://aipocketagent.com/api/channels/slack/callback");
  });

  it("honors PA_OAUTH_REDIRECT_BASE and trims a trailing slash", () => {
    process.env.PA_OAUTH_REDIRECT_BASE = "https://staging.example.com/";
    expect(channelSlackRedirectUri()).toBe(
      "https://staging.example.com/api/channels/slack/callback",
    );
  });
});

describe("buildChannelSlackAuthorizeUrl", () => {
  it("builds the authorize URL with the SPEC §8.2 scopes + state", () => {
    const url = new URL(buildChannelSlackAuthorizeUrl("client-123", "state-abc"));
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://aipocketagent.com/api/channels/slack/callback",
    );
    expect(url.searchParams.get("scope")).toBe(CHANNEL_SLACK_SCOPES.join(","));
  });

  it("requests exactly the channel scopes (no over-asking)", () => {
    expect([...CHANNEL_SLACK_SCOPES]).toEqual([
      "chat:write",
      "im:history",
      "im:read",
      "users:read",
      "app_mentions:read",
    ]);
  });
});
