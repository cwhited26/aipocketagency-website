// webinar.test.ts — the 20 webinar-funnel templates render correctly, the schedule computes the right
// send_at offsets relative to the live session, and the marketing data files carry the full catalogs.

import { describe, expect, it } from "vitest";
import { EMAIL_REGISTRY, isTransactional, renderBySlug, SEQUENCE } from "../registry";
import { WEBINAR_SEQUENCE, computeWebinarSchedule } from "../sequences";
import { SEGMENTATION_TAGS } from "@/data/marketing/segmentation-tags";
import retargetingAds from "@/data/marketing/webinar-retargeting-ads.json";

const SAMPLE = { email: "owner@example.com", firstName: "Sam" };
const BANNED_DOMAIN = "aipocketagency.com";

const WEBINAR_SLUGS = [
  "webinar.registration-confirmation",
  "webinar.reminder-24h",
  "webinar.morning-of",
  "webinar.reminder-1h",
  "webinar.reminder-15m",
  "webinar.live-now",
  "webinar.missed-replay",
  "webinar.attendee-recap",
  "webinar.problem-agitation",
  "webinar.business-brain",
  "webinar.personas",
  "webinar.apps",
  "webinar.idea-engine",
  "webinar.lead-scout",
  "webinar.mission-control",
  "webinar.guarantee",
  "webinar.plan-choice",
  "webinar.last-call",
  "webinar.pilot-pitch",
  "webinar.diy-kit-pitch",
] as const;

describe("webinar email templates", () => {
  it("registers all 20 webinar slugs on the webinar sequence", () => {
    for (const slug of WEBINAR_SLUGS) {
      expect(EMAIL_REGISTRY[slug]).toBeDefined();
      expect(EMAIL_REGISTRY[slug].sequence).toBe(SEQUENCE.webinar);
    }
    const registered = Object.keys(EMAIL_REGISTRY).filter((s) => s.startsWith("webinar."));
    expect(registered).toHaveLength(20);
  });

  it.each(WEBINAR_SLUGS)("renders %s to valid html + text with subject, footer, unsubscribe", (slug) => {
    const r = renderBySlug(slug, SAMPLE);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.subject.trim().length).toBeGreaterThan(0);
    expect(r.html).toContain("<html");
    expect(r.html).toContain("</html>");
    expect(r.text.trim().length).toBeGreaterThan(0);
    // Footer sender.
    expect(r.html).toContain("chase@aipocketagent.com");
    expect(r.text).toContain("chase@aipocketagent.com");
    // Never the banned 'cy' domain (domain-scan extended to webinar templates).
    expect(r.html).not.toContain(BANNED_DOMAIN);
    expect(r.text).not.toContain(BANNED_DOMAIN);
    // All webinar mail is marketing → unsubscribe link present.
    expect(isTransactional(slug)).toBe(false);
    expect(r.html).toContain("/unsubscribe?");
    expect(r.text).toContain("/unsubscribe?");
  });

  it("reproduces the Idea Engine paragraph byte-for-byte", () => {
    const r = renderBySlug("webinar.idea-engine", SAMPLE);
    expect(r?.text).toContain(
      "Drop an idea — a voice memo, a podcast you just listened to, a thought you had in the shower. Pocket Agent validates whether real people would buy it, plans the version that should actually ship, builds it for you, gets a sales page live, and lines up the first 25 prospects to email. By the time you finish your morning coffee, your idea is a real thing on the internet you can show people.",
    );
  });

  it("includes the Implementation Guarantee verbatim in the guarantee email", () => {
    const r = renderBySlug("webinar.guarantee", SAMPLE);
    expect(r?.text).toContain("Complete the Launch Kit's 7-day setup steps.");
    expect(r?.text).toContain(
      "If you do not have 3 trained Personas and 3 working workflows inside Pocket Agent by day 7, we help you finish the setup.",
    );
  });
});

describe("webinar schedule offsets", () => {
  const HOUR = 60 * 60_000;
  const DAY = 24 * HOUR;
  const now = 1_700_000_000_000; // fixed
  const webinarAt = now + 60 * DAY; // far future → nothing dropped

  const schedule = computeWebinarSchedule(webinarAt, now);
  const bySlug = new Map(schedule.map((s) => [s.slug, Date.parse(s.sendAt)]));

  it("enqueues all 20 emails when the webinar is in the future", () => {
    expect(schedule).toHaveLength(20);
    expect(WEBINAR_SEQUENCE).toHaveLength(20);
  });

  it("sends the registration confirmation immediately", () => {
    expect(bySlug.get("webinar.registration-confirmation")).toBe(now);
  });

  it("schedules the reminders before the webinar", () => {
    expect(bySlug.get("webinar.reminder-24h")).toBe(webinarAt - 24 * HOUR);
    expect(bySlug.get("webinar.morning-of")).toBe(webinarAt - 4 * HOUR);
    expect(bySlug.get("webinar.reminder-1h")).toBe(webinarAt - 1 * HOUR);
    expect(bySlug.get("webinar.reminder-15m")).toBe(webinarAt - 15 * 60_000);
  });

  it("schedules live at the webinar and missed/recap 4h after", () => {
    expect(bySlug.get("webinar.live-now")).toBe(webinarAt);
    expect(bySlug.get("webinar.missed-replay")).toBe(webinarAt + 4 * HOUR);
    expect(bySlug.get("webinar.attendee-recap")).toBe(webinarAt + 4 * HOUR);
  });

  it("schedules the 12 nurture emails on days 1-12 after the webinar", () => {
    const nurture: [string, number][] = [
      ["webinar.problem-agitation", 1],
      ["webinar.business-brain", 2],
      ["webinar.personas", 3],
      ["webinar.apps", 4],
      ["webinar.idea-engine", 5],
      ["webinar.lead-scout", 6],
      ["webinar.mission-control", 7],
      ["webinar.guarantee", 8],
      ["webinar.plan-choice", 9],
      ["webinar.last-call", 10],
      ["webinar.pilot-pitch", 11],
      ["webinar.diy-kit-pitch", 12],
    ];
    for (const [slug, day] of nurture) {
      expect(bySlug.get(slug)).toBe(webinarAt + day * DAY);
    }
  });

  it("drops pre-webinar reminders that already passed for a late registrant", () => {
    // Webinar is 30 minutes out: the 24h/4h/1h reminders are in the past and dropped; the 15m
    // reminder, live, replay, recap, and nurture remain, plus the immediate confirmation.
    const soon = now + 30 * 60_000;
    const late = computeWebinarSchedule(soon, now);
    const slugs = late.map((s) => s.slug);
    expect(slugs).toContain("webinar.registration-confirmation");
    expect(slugs).toContain("webinar.reminder-15m");
    expect(slugs).toContain("webinar.live-now");
    expect(slugs).not.toContain("webinar.reminder-24h");
    expect(slugs).not.toContain("webinar.morning-of");
    expect(slugs).not.toContain("webinar.reminder-1h");
  });
});

describe("webinar marketing data", () => {
  it("has the 25 segmentation tags from Part 3E", () => {
    expect(SEGMENTATION_TAGS).toHaveLength(25);
    expect(SEGMENTATION_TAGS[0].label).toBe("Registered - Webinar");
    expect(SEGMENTATION_TAGS.map((t) => t.label)).toContain("Activated - 3-3-3");
  });

  it("has the 5 retargeting ads from Part 3F", () => {
    expect(retargetingAds.ads).toHaveLength(5);
    for (const ad of retargetingAds.ads) {
      expect(ad.id.length).toBeGreaterThan(0);
      expect(ad.audience.length).toBeGreaterThan(0);
      expect(ad.hook.length).toBeGreaterThan(0);
      expect(ad.copy.length).toBeGreaterThan(0);
      expect(ad.cta.length).toBeGreaterThan(0);
    }
  });
});
