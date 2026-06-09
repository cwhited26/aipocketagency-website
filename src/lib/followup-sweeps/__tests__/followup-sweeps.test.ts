import { describe, it, expect } from "vitest";
import {
  DEFAULT_DORMANCY_DAYS,
  REDRAFT_COOLDOWN_DAYS,
  SWEEP_INTERVAL_DAYS,
  TONE_BY_RELATIONSHIP,
  toneFor,
} from "../types";
import { nextSweepAt } from "../db";
import { extractLastTouched, extractName, parseAddress } from "../discover";

describe("follow-up sweeps — domain constants", () => {
  it("default dormancy thresholds match PA-FUS-1 (14 / 30 / 60)", () => {
    expect(DEFAULT_DORMANCY_DAYS.cold_lead).toBe(14);
    expect(DEFAULT_DORMANCY_DAYS.active_customer).toBe(30);
    expect(DEFAULT_DORMANCY_DAYS.past_customer).toBe(60);
  });

  it("re-draft cooldown and sweep cadence are both 7 days", () => {
    expect(REDRAFT_COOLDOWN_DAYS).toBe(7);
    expect(SWEEP_INTERVAL_DAYS).toBe(7);
  });

  it("every relationship has a distinct, complete tone spec (PA-FUS-2)", () => {
    for (const rel of ["cold_lead", "active_customer", "past_customer"] as const) {
      const spec = toneFor(rel);
      expect(spec).toBe(TONE_BY_RELATIONSHIP[rel]);
      expect(spec.tone).toBeTruthy();
      expect(spec.purpose).toBeTruthy();
      expect(spec.relationshipLabel).toBeTruthy();
      expect(spec.subjectDefault).toBeTruthy();
    }
    const subjects = new Set(
      (["cold_lead", "active_customer", "past_customer"] as const).map((r) => toneFor(r).subjectDefault),
    );
    expect(subjects.size).toBe(3);
  });
});

describe("nextSweepAt", () => {
  it("advances exactly the sweep interval from the given time", () => {
    const from = new Date("2026-06-07T08:00:00.000Z");
    expect(nextSweepAt(from)).toBe("2026-06-14T08:00:00.000Z");
  });
});

describe("parseAddress", () => {
  it("splits a display-name address", () => {
    expect(parseAddress("Maria Delgado <maria@example.com>")).toEqual({
      email: "maria@example.com",
      name: "Maria Delgado",
    });
  });

  it("lowercases the email and handles a bare address (no name)", () => {
    expect(parseAddress("BoB@Example.COM")).toEqual({ email: "bob@example.com", name: null });
  });

  it("strips quotes from a quoted display name", () => {
    expect(parseAddress('"Carter Kitchen" <hi@carter.co>')).toEqual({
      email: "hi@carter.co",
      name: "Carter Kitchen",
    });
  });

  it("returns null when there's no email", () => {
    expect(parseAddress("no address here")).toBeNull();
  });
});

describe("extractLastTouched", () => {
  it("prefers a frontmatter last_contact date", () => {
    const md = "---\nname: Acme\nlast_contact: 2026-01-15\n---\n\nSpoke on 2025-12-01.";
    expect(extractLastTouched(md)).toBe("2026-01-15T00:00:00.000Z");
  });

  it("falls back to the latest ISO date in the file", () => {
    const md = "Met 2025-03-04. Quoted 2025-09-20. Note from 2025-06-11.";
    expect(extractLastTouched(md)).toBe("2025-09-20T00:00:00.000Z");
  });

  it("returns null when no date is present", () => {
    expect(extractLastTouched("Just a name and a phone number.")).toBeNull();
  });
});

describe("extractName", () => {
  it("prefers a frontmatter name", () => {
    expect(extractName("---\nname: Hale Wedding\n---\n# Other", "file.md")).toBe("Hale Wedding");
  });

  it("falls back to the first heading", () => {
    expect(extractName("# Maria Delgado\n\nbody", "x.md")).toBe("Maria Delgado");
  });

  it("humanizes the filename as a last resort", () => {
    expect(extractName("no name, no heading", "carter-kitchen-remodel.md")).toBe(
      "Carter Kitchen Remodel",
    );
  });
});
