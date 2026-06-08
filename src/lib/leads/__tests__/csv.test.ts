import { describe, it, expect } from "vitest";
import { leadsToCsv } from "../csv";
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
    contact: "hi@example.com",
    summary: "Roofing contractor",
    profile: {},
    classification: "warm",
    brain_path: null,
    status: "extracted",
    error: null,
    created_at: "2026-06-08T00:00:00Z",
    ...partial,
  };
}

describe("leadsToCsv", () => {
  it("writes a header plus one row per lead", () => {
    const csv = leadsToCsv([lead({}), lead({ id: "l2", name: "Two" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("url,domain,name,contact,classification,summary,status");
  });

  it("adds a column per distinct extracted field key", () => {
    const csv = leadsToCsv([
      lead({ profile: { owner: "Pat", phone: "555-1212" } }),
      lead({ id: "l2", profile: { owner: "Sam", years: "10" } }),
    ]);
    const header = csv.split("\r\n")[0];
    expect(header).toContain("owner");
    expect(header).toContain("phone");
    expect(header).toContain("years");
  });

  it("quotes and escapes fields with commas, quotes, or newlines", () => {
    const csv = leadsToCsv([lead({ summary: 'Sells "premium", fast' })]);
    expect(csv).toContain('"Sells ""premium"", fast"');
  });
});
