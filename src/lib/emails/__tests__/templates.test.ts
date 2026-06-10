// templates.test.ts — every registered template renders to valid HTML + plaintext, carries a subject,
// shows the footer (sender + unsubscribe for marketing mail), and never leaks the banned 'cy' domain.

import { describe, expect, it } from "vitest";
import { EMAIL_REGISTRY, isTransactional, renderBySlug } from "../registry";

const SAMPLE = { email: "owner@example.com", firstName: "Sam" };
const BANNED_DOMAIN = "aipocketagency.com";

describe("email template registry", () => {
  const slugs = Object.keys(EMAIL_REGISTRY);

  it("has the full Part-5 catalog (50+ templates)", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(50);
  });

  it.each(slugs)("renders %s to valid html + text", (slug) => {
    const r = renderBySlug(slug, SAMPLE);
    expect(r).not.toBeNull();
    if (!r) return;

    // Subject present.
    expect(r.subject.trim().length).toBeGreaterThan(0);
    // Valid-ish HTML + non-empty plaintext.
    expect(r.html).toContain("<html");
    expect(r.html).toContain("</html>");
    expect(r.text.trim().length).toBeGreaterThan(0);
    // Footer carries the sender contact.
    expect(r.html).toContain("chase@aipocketagent.com");
    expect(r.text).toContain("chase@aipocketagent.com");
    // Never the banned 'cy' domain.
    expect(r.html).not.toContain(BANNED_DOMAIN);
    expect(r.text).not.toContain(BANNED_DOMAIN);

    // Marketing mail must carry an unsubscribe link; transactional mail must not.
    if (isTransactional(slug)) {
      expect(r.html).not.toContain("/unsubscribe?");
    } else {
      expect(r.html).toContain("/unsubscribe?");
      expect(r.text).toContain("/unsubscribe?");
    }
  });

  it("returns null for an unknown slug", () => {
    expect(renderBySlug("nope.not-real", SAMPLE)).toBeNull();
  });

  it("rejects malformed props (no email)", () => {
    expect(() => renderBySlug("onboarding.day-3-workflow", { firstName: "x" })).toThrow();
  });
});
