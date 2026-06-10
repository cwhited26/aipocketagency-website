import { describe, it, expect } from "vitest";
import {
  isAddonCheckoutKind,
  getAddonMeta,
  ADDON_CATALOG,
} from "@/lib/pocket-agent-addons";
import { buildPocketAgentCheckoutParams } from "@/lib/pocket-agent-checkout";
import { isOperatorEmail } from "@/lib/operator";
import {
  callDurationMinutes,
  bookingLink,
  buildIcs,
  googleCalendarUrl,
  inviteEmailBody,
} from "@/lib/setup-sprint/calendar-invite-template";
import {
  LAUNCH_KIT_STEPS,
  LAUNCH_KIT_STEP_COUNT,
  isLaunchKitStepSlug,
  IMPLEMENTATION_GUARANTEE,
} from "@/lib/launch-kit/steps";

describe("v5 add-on catalog", () => {
  it("recognizes the two new charged kinds", () => {
    expect(isAddonCheckoutKind("workflow_vault")).toBe(true);
    expect(isAddonCheckoutKind("diy_setup_kit")).toBe(true);
    expect(isAddonCheckoutKind("nope")).toBe(false);
  });

  it("prices the Vault at $47 and the DIY Kit at $97", () => {
    expect(getAddonMeta("workflow_vault").amountCents).toBe(4_700);
    expect(getAddonMeta("diy_setup_kit").amountCents).toBe(9_700);
    expect(ADDON_CATALOG.workflow_vault.thanksBranch).toBe("workflow_vault");
    expect(ADDON_CATALOG.diy_setup_kit.thanksBranch).toBe("diy_setup_kit");
  });
});

describe("/start checkout bumps", () => {
  const base = {
    email: "a@b.com",
    name: "",
    tier: "pro" as const,
    priceId: "price_x",
    origin: "https://aipocketagent.com",
    userId: null,
  };

  it("adds the Vault invoice line + flag when vault is set", () => {
    const p = buildPocketAgentCheckoutParams({ ...base, vault: true });
    expect(p.get("subscription_data[add_invoice_items][0][price_data][unit_amount]")).toBe("4700");
    expect(p.get("metadata[bump_workflow_vault]")).toBe("true");
    expect(p.get("subscription_data[metadata][bump_workflow_vault]")).toBe("true");
  });

  it("stacks both bumps without index collision", () => {
    const p = buildPocketAgentCheckoutParams({ ...base, bump: true, vault: true });
    expect(p.get("subscription_data[add_invoice_items][0][price_data][unit_amount]")).toBe("4900");
    expect(p.get("subscription_data[add_invoice_items][1][price_data][unit_amount]")).toBe("4700");
  });

  it("adds no Vault line when vault is unset", () => {
    const p = buildPocketAgentCheckoutParams(base);
    expect(p.get("metadata[bump_workflow_vault]")).toBeNull();
  });
});

describe("operator gate", () => {
  it("matches the default operator, case-insensitively; rejects others/empty", () => {
    expect(isOperatorEmail("cwhited94@gmail.com")).toBe(true);
    expect(isOperatorEmail("CWHITED94@GMAIL.COM")).toBe(true);
    expect(isOperatorEmail("random@example.com")).toBe(false);
    expect(isOperatorEmail(null)).toBe(false);
    expect(isOperatorEmail("")).toBe(false);
  });
});

describe("setup sprint calendar invite", () => {
  it("is 60 min standard, 90 min premium", () => {
    expect(callDurationMinutes("standard")).toBe(60);
    expect(callDurationMinutes("premium")).toBe(90);
  });

  it("builds a valid ICS skeleton", () => {
    const ics = buildIcs({
      tier: "standard",
      startsAt: new Date("2026-07-01T15:00:00Z"),
      uid: "sprint-1",
      organizerEmail: "chase@aipocketagent.com",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:sprint-1");
    expect(ics).toContain("END:VEVENT");
  });

  it("google url and booking link use aipocketagent.com surfaces", () => {
    const url = googleCalendarUrl("premium", new Date("2026-07-01T15:00:00Z"));
    expect(url).toContain("calendar.google.com");
    expect(bookingLink()).toContain("aipocketagent.com");
    expect(inviteEmailBody("premium").subject).toContain("90");
  });
});

describe("launch kit steps", () => {
  it("has unique step slugs and a matching count", () => {
    const slugs = new Set(LAUNCH_KIT_STEPS.map((s) => s.slug));
    expect(slugs.size).toBe(LAUNCH_KIT_STEPS.length);
    expect(LAUNCH_KIT_STEP_COUNT).toBe(LAUNCH_KIT_STEPS.length);
  });

  it("validates step slugs and exposes the guarantee verbatim", () => {
    expect(isLaunchKitStepSlug("brain-offers")).toBe(true);
    expect(isLaunchKitStepSlug("nope")).toBe(false);
    expect(IMPLEMENTATION_GUARANTEE).toBe(
      "Complete the 7-day checklist or Pocket Agent helps you finish.",
    );
  });
});
