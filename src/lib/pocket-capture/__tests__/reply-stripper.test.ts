import { describe, it, expect } from "vitest";
import { stripQuotedReply } from "../reply-stripper";

describe("stripQuotedReply", () => {
  it("returns a plain body with no quote chain unchanged", () => {
    expect(stripQuotedReply("Just a quick thought to save.")).toBe("Just a quick thought to save.");
  });

  it("strips a Gmail-style attribution + > quoted chain", () => {
    const body = [
      "Thanks, that works for me.",
      "",
      "On Mon, Jun 23, 2026 at 3:00 PM John Doe <john@example.com> wrote:",
      "> Are you free tomorrow?",
      "> Let me know.",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Thanks, that works for me.");
  });

  it("strips an Apple Mail attribution and everything after it", () => {
    const body = [
      "Sounds good.",
      "",
      "On Jun 23, 2026, at 3:00 PM, Jane <jane@example.com> wrote:",
      "",
      "Here is the original message text.",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Sounds good.");
  });

  it("strips an Outlook -----Original Message----- block", () => {
    const body = [
      "See my reply above.",
      "",
      "-----Original Message-----",
      "From: Bob <bob@example.com>",
      "Sent: Monday, June 23, 2026 3:00 PM",
      "To: Me",
      "Subject: Hi",
      "",
      "Original text here.",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("See my reply above.");
  });

  it("strips an Outlook underscore-divider + From: header block", () => {
    const body = [
      "Reply text.",
      "________________________________",
      "From: Bob <bob@example.com>",
      "Sent: Monday, June 23, 2026 3:00 PM",
      "",
      "Quoted original.",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Reply text.");
  });

  it("handles an attribution that wrapped across two lines", () => {
    const body = [
      "Got it.",
      "",
      "On Mon, Jun 23, 2026 at 3:00 PM John Doe",
      "<john@example.com> wrote:",
      "> hi",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Got it.");
  });

  it("unwraps a reply that is nothing but a > quoted block", () => {
    const body = ["> just the quote", "> second line"].join("\n");
    expect(stripQuotedReply(body)).toBe("just the quote\nsecond line");
  });

  it("keeps a forwarded-message body (forwarding IS the capture)", () => {
    const body = [
      "Check this out",
      "",
      "---------- Forwarded message ---------",
      "From: Newsletter <news@example.com>",
      "Subject: Weekly digest",
      "",
      "Big news today.",
    ].join("\n");
    const out = stripQuotedReply(body);
    expect(out).toContain("Forwarded message");
    expect(out).toContain("Big news today.");
  });

  it("returns empty string for empty input", () => {
    expect(stripQuotedReply("")).toBe("");
  });
});
