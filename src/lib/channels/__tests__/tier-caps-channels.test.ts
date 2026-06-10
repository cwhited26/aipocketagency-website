// Tier-gating for the Channels Gateway (PA-CHAN-7): Personal Brain off / Business Agent = Slack /
// Pro+ and up = all channels.

import { describe, expect, it } from "vitest";
import { tierAllowsChannel, tierCanSeeChannels } from "@/lib/personas/tier-caps";

describe("tierAllowsChannel", () => {
  it("blocks Slack on Personal Brain (starter)", () => {
    expect(tierAllowsChannel("starter", "slack")).toBe(false);
  });

  it("allows Slack from Business Agent (pro) up", () => {
    expect(tierAllowsChannel("pro", "slack")).toBe(true);
    expect(tierAllowsChannel("pro_plus", "slack")).toBe(true);
    expect(tierAllowsChannel("enterprise", "slack")).toBe(true);
  });

  it("gates non-Slack (queued) channels to Pro+ and up", () => {
    expect(tierAllowsChannel("pro", "sms")).toBe(false);
    expect(tierAllowsChannel("pro_plus", "sms")).toBe(true);
  });
});

describe("tierCanSeeChannels", () => {
  it("hides the surface on Personal Brain, shows it from Business Agent up", () => {
    expect(tierCanSeeChannels("starter")).toBe(false);
    expect(tierCanSeeChannels("pro")).toBe(true);
    expect(tierCanSeeChannels("studio")).toBe(true);
  });
});
