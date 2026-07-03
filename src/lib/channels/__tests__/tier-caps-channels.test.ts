// Tier-gating for the Channels Gateway (PA-CHAN-7 + the Phase 2–4 gates): Personal Brain off /
// Business Agent = the shipped text channels (Slack, Telegram, SMS, WhatsApp) / iMessage at
// Studio+ / everything still queued at Pro+ and up.

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

  it("allows SMS and WhatsApp from Business Agent (pro) up (Phase 2/4)", () => {
    expect(tierAllowsChannel("starter", "sms")).toBe(false);
    expect(tierAllowsChannel("pro", "sms")).toBe(true);
    expect(tierAllowsChannel("starter", "whatsapp")).toBe(false);
    expect(tierAllowsChannel("pro", "whatsapp")).toBe(true);
  });

  it("gates iMessage to Studio+ and Enterprise only (Phase 3 — power-user channel)", () => {
    expect(tierAllowsChannel("pro", "imessage")).toBe(false);
    expect(tierAllowsChannel("pro_plus", "imessage")).toBe(false);
    expect(tierAllowsChannel("studio", "imessage")).toBe(false);
    expect(tierAllowsChannel("studio_plus", "imessage")).toBe(true);
    expect(tierAllowsChannel("enterprise", "imessage")).toBe(true);
  });

  it("gates still-queued channels to Pro+ and up", () => {
    expect(tierAllowsChannel("pro", "web_widget")).toBe(false);
    expect(tierAllowsChannel("pro_plus", "web_widget")).toBe(true);
  });
});

describe("tierCanSeeChannels", () => {
  it("hides the surface on Personal Brain, shows it from Business Agent up", () => {
    expect(tierCanSeeChannels("starter")).toBe(false);
    expect(tierCanSeeChannels("pro")).toBe(true);
    expect(tierCanSeeChannels("studio")).toBe(true);
  });
});
