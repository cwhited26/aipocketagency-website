import { describe, it, expect } from "vitest";
import { buildCaptureContent } from "../capture";
import { safeFilename } from "../storage";

describe("buildCaptureContent", () => {
  it("combines sender + subject + body", () => {
    const out = buildCaptureContent({
      fromDisplay: "Jane <jane@example.com>",
      subject: "Idea for the launch",
      strippedBody: "Run the webinar twice.",
      stored: [],
      attachmentErrors: [],
    });
    expect(out).toContain("From: Jane <jane@example.com>");
    expect(out).toContain("Subject: Idea for the launch");
    expect(out).toContain("Run the webinar twice.");
    expect(out).not.toContain("Attachments:");
  });

  it("lists stored attachments and upload errors", () => {
    const out = buildCaptureContent({
      fromDisplay: "a@b.com",
      subject: "Files",
      strippedBody: "",
      stored: [{ filename: "deck.pdf", path: "pocket-capture/owner-1/cap-1/deck.pdf" }],
      attachmentErrors: ["huge.zip — upload failed: too big"],
    });
    expect(out).toContain("Attachments:");
    expect(out).toContain("- deck.pdf — stored at pocket-capture/owner-1/cap-1/deck.pdf");
    expect(out).toContain("- huge.zip — upload failed: too big");
  });

  it("falls back to placeholders for an empty sender + subject", () => {
    const out = buildCaptureContent({
      fromDisplay: "",
      subject: "",
      strippedBody: "body",
      stored: [],
      attachmentErrors: [],
    });
    expect(out).toContain("From: (unknown sender)");
    expect(out).toContain("Subject: (no subject)");
  });
});

describe("safeFilename", () => {
  it("strips path components (traversal-safe)", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
  });
  it("replaces unsafe characters", () => {
    expect(safeFilename("my file (1).pdf")).toBe("my_file_1_.pdf");
  });
  it("drops leading dots", () => {
    expect(safeFilename(".env")).toBe("env");
  });
  it("falls back to a default for an empty name", () => {
    expect(safeFilename("")).toBe("attachment");
  });
});
