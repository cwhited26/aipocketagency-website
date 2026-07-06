// The workshop voice gate (PA-POS-38 §24.7) + the sales-page render test. Copy rules: honest
// math, no urgency theater, cancel-anytime visible, no slop vocabulary, no exclamation cheer.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WORKSHOP_COPY } from "../copy";
import WorkshopPage from "@/app/(marketing)/workshop/page";

function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => allStrings(v, out));
  }
  return out;
}

describe("workshop copy voice gate", () => {
  const strings = allStrings(WORKSHOP_COPY);

  it("keeps slop vocabulary out of every customer-facing string", () => {
    const banned =
      /\b(leverage|unlock|empower|seamless|revolutionary|elevate|robust|game.?chang|cutting.?edge|next.?level|world.?class|genuinely|honestly|straightforward)\b/i;
    for (const s of strings) {
      expect(s, s).not.toMatch(banned);
    }
  });

  it("runs no urgency theater — no countdown-scarcity phrases, no shouted value stacks", () => {
    const theater = /\b(limited time|act now|don't miss|hurry|spots? (are )?filling|only \d+ (left|seats))\b/i;
    for (const s of strings) {
      expect(s, s).not.toMatch(theater);
      expect(s, s).not.toMatch(/!{2,}/);
    }
  });

  it("states the honest frame: $194 of value, $97 today, day-31 renewal, cancel visible", () => {
    expect(WORKSHOP_COPY.frame.valueLine).toBe("$194 of value. You pay $97 today.");
    expect(WORKSHOP_COPY.frame.renewal).toContain("$97/mo on day 31");
    expect(WORKSHOP_COPY.frame.renewal.toLowerCase()).toContain("cancel");
    expect(WORKSHOP_COPY.checkout.underButton.toLowerCase()).toContain("cancel");
  });
});

describe("/workshop sales page", () => {
  it("renders: hero headline, the bullets, the transparent frame, the CTA", () => {
    const html = renderToStaticMarkup(createElement(WorkshopPage));
    expect(html).toContain("give your AI a permanent memory of your business in 60 minutes");
    expect(html).toContain("$194 of value. You pay $97 today.");
    expect(html).toContain("Reserve your seat — $97");
    expect(html).toContain("30 days of Pocket Agent Business Agent tier");
    expect(html).toContain("Skool");
  });
});
