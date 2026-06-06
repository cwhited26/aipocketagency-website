import { describe, it, expect } from "vitest";
import { extractLeadFromText, hasLeadSignal } from "../leads";

describe("extractLeadFromText — positive cases", () => {
  it("captures an intent-phrased email", () => {
    expect(extractLeadFromText("my email is Jane@Acme.com").email).toBe("jane@acme.com");
  });
  it("captures a bare email in prose", () => {
    expect(extractLeadFromText("reach out to support@acme.io for details").email).toBe(
      "support@acme.io",
    );
  });
  it("captures an intent-phrased phone", () => {
    const lead = extractLeadFromText("you can call me at (555) 123-4567");
    expect(lead.phone).toBe("5551234567");
  });
  it("captures a name from a self-introduction", () => {
    expect(extractLeadFromText("Hi, my name is John Smith").name).toBe("John Smith");
  });
  it("captures email + phone + name together", () => {
    const lead = extractLeadFromText("My name is Maria Lopez, my email is maria@x.com and my phone is 555-987-6543");
    expect(lead.name).toBe("Maria Lopez");
    expect(lead.email).toBe("maria@x.com");
    expect(lead.phone).toBe("5559876543");
  });
  it("captures a bare phone only when an email is also present", () => {
    const lead = extractLeadFromText("contact me: a@b.com or 555 222 3333");
    expect(lead.email).toBe("a@b.com");
    expect(lead.phone).toBe("5552223333");
  });
});

describe("extractLeadFromText — negative cases", () => {
  it("does not treat 'I'm interested' as a name", () => {
    expect(extractLeadFromText("I'm interested in your pricing").name).toBeNull();
  });
  it("does not capture a name from a generic sentence", () => {
    expect(extractLeadFromText("Can you help me find a plan?").name).toBeNull();
  });
  it("does not capture a lone number as a phone without an email", () => {
    expect(extractLeadFromText("my order 1234567 has not shipped").phone).toBeNull();
  });
  it("does not capture a year as a phone", () => {
    expect(extractLeadFromText("the year 2024 was great").phone).toBeNull();
  });
  it("returns all-null and no signal for a plain question", () => {
    const lead = extractLeadFromText("what are your hours?");
    expect(lead.email).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.name).toBeNull();
    expect(hasLeadSignal(lead)).toBe(false);
  });
});

describe("hasLeadSignal", () => {
  it("is true when any field is present", () => {
    expect(hasLeadSignal({ email: "a@b.com", phone: null, name: null })).toBe(true);
    expect(hasLeadSignal({ email: null, phone: "5551234567", name: null })).toBe(true);
    expect(hasLeadSignal({ email: null, phone: null, name: "Jo" })).toBe(true);
  });
  it("is false when all fields are null", () => {
    expect(hasLeadSignal({ email: null, phone: null, name: null })).toBe(false);
  });
});
