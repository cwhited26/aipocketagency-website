import { describe, it, expect } from "vitest";
import { recipientFor, profileStrings } from "../outreach";
import { nextRunFor } from "../schedule";
import { splitSubjectBody } from "../../pa-drafts";
import type { LeadScoutLead } from "../types";

function lead(partial: Partial<LeadScoutLead>): LeadScoutLead {
  return {
    id: "l1",
    run_id: "r1",
    source_id: "s1",
    owner_id: "o1",
    url: "https://example.com",
    domain: "example.com",
    name: "Example Co",
    contact: "",
    summary: "Roofing contractor",
    profile: {},
    classification: "warm",
    brain_path: null,
    status: "extracted",
    error: null,
    outreach_drafted_at: null,
    created_at: "2026-06-08T00:00:00Z",
    ...partial,
  };
}

describe("recipientFor", () => {
  it("prefers an explicit profile.email", () => {
    expect(recipientFor(lead({ profile: { email: "owner@roofco.com" }, contact: "(865) 555-0118" }))).toBe(
      "owner@roofco.com",
    );
  });

  it("falls back to an email embedded in the contact column", () => {
    expect(recipientFor(lead({ contact: "Reach Pat at pat@roofco.com anytime" }))).toBe("pat@roofco.com");
  });

  it("scans any profile value for an email when there's no dedicated field", () => {
    expect(recipientFor(lead({ profile: { notes: "site says hello@biz.io" } }))).toBe("hello@biz.io");
  });

  it("returns empty when the lead has no email (no-website business with only a phone)", () => {
    expect(recipientFor(lead({ contact: "(865) 555-0143", profile: { phone: "(865) 555-0143" } }))).toBe("");
  });
});

describe("profileStrings", () => {
  it("flattens profile values to strings and drops empties", () => {
    const out = profileStrings(
      lead({ profile: { phone: "555", has_website: false, rating: 4.7, empty: "", nil: null } }),
    );
    expect(out).toEqual({ phone: "555", has_website: "false", rating: "4.7" });
  });
});

describe("splitSubjectBody", () => {
  it("splits a leading Subject: line from the body", () => {
    const { subject, body } = splitSubjectBody("Subject: A site for Summit\n\nSummit —\nYour reviews are strong…");
    expect(subject).toBe("A site for Summit");
    expect(body.startsWith("Summit —")).toBe(true);
  });

  it("returns an empty subject when the model omits one", () => {
    const { subject, body } = splitSubjectBody("Summit —\nQuick note about your listing.");
    expect(subject).toBe("");
    expect(body.startsWith("Summit —")).toBe(true);
  });
});

describe("nextRunFor", () => {
  const from = new Date("2026-06-08T12:00:00Z");

  it("returns null for on_demand (never auto-runs)", () => {
    expect(nextRunFor("on_demand", from)).toBeNull();
  });

  it("advances one day for daily", () => {
    expect(nextRunFor("daily", from)).toBe("2026-06-09T12:00:00.000Z");
  });

  it("advances seven days for weekly", () => {
    expect(nextRunFor("weekly", from)).toBe("2026-06-15T12:00:00.000Z");
  });
});
