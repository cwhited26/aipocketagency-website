import { describe, it, expect } from "vitest";
import {
  GmailSendInputSchema,
  buildMimeMessage,
  dryRunSummary,
  auditFields,
  execute,
  type GmailSendInput,
} from "../actions/send";

// Decode a base64 transfer-encoded MIME body back to text for assertions.
function decodeBody(raw: string): string {
  const [, body] = raw.split("\r\n\r\n");
  return Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8");
}

describe("GmailSendInputSchema", () => {
  it("requires at least one recipient and a subject", () => {
    expect(GmailSendInputSchema.safeParse({ to: [], subject: "Hi", body_text: "x" }).success).toBe(
      false,
    );
    expect(
      GmailSendInputSchema.safeParse({ to: ["a@b.com"], subject: "", body_text: "x" }).success,
    ).toBe(false);
  });

  it("requires either body_html or body_text", () => {
    expect(GmailSendInputSchema.safeParse({ to: ["a@b.com"], subject: "Hi" }).success).toBe(false);
    expect(
      GmailSendInputSchema.safeParse({ to: ["a@b.com"], subject: "Hi", body_text: "x" }).success,
    ).toBe(true);
  });
});

describe("buildMimeMessage", () => {
  const base: GmailSendInput = {
    to: ["alice@example.com"],
    subject: "Re: Quote",
    body_text: "Sounds good — see attached.",
  };

  it("sets From to the connected account when not overridden", () => {
    const raw = buildMimeMessage(base, "owner@example.com");
    expect(raw).toContain("From: owner@example.com");
    expect(raw).toContain("To: alice@example.com");
    expect(raw).toContain("Subject: Re: Quote");
    expect(raw).toContain("Content-Type: text/plain");
  });

  it("prefers an explicit from override", () => {
    const raw = buildMimeMessage({ ...base, from: "me@example.com" }, "owner@example.com");
    expect(raw).toContain("From: me@example.com");
  });

  it("emits In-Reply-To + References (angle-wrapped) when in_reply_to is present", () => {
    const raw = buildMimeMessage({ ...base, in_reply_to: "CA+abc@mail.gmail.com" }, null);
    expect(raw).toContain("In-Reply-To: <CA+abc@mail.gmail.com>");
    expect(raw).toContain("References: <CA+abc@mail.gmail.com>");
  });

  it("does not double-wrap an already-bracketed Message-ID", () => {
    const raw = buildMimeMessage({ ...base, in_reply_to: "<CA+abc@mail.gmail.com>" }, null);
    expect(raw).toContain("In-Reply-To: <CA+abc@mail.gmail.com>");
    expect(raw).not.toContain("<<");
  });

  it("RFC 2047 encodes a non-ASCII subject", () => {
    const raw = buildMimeMessage({ ...base, subject: "Café ☕" }, null);
    expect(raw).toContain("Subject: =?UTF-8?B?");
  });

  it("round-trips the body through base64 transfer-encoding", () => {
    const raw = buildMimeMessage(base, null);
    expect(raw).toContain("Content-Transfer-Encoding: base64");
    expect(decodeBody(raw)).toBe("Sounds good — see attached.");
  });

  it("uses text/html when body_html is supplied", () => {
    const raw = buildMimeMessage(
      { to: ["a@b.com"], subject: "Hi", body_html: "<p>hi</p>" },
      null,
    );
    expect(raw).toContain("Content-Type: text/html");
    expect(decodeBody(raw)).toBe("<p>hi</p>");
  });

  it("includes Cc but never an empty header", () => {
    const raw = buildMimeMessage({ ...base, cc: ["c@b.com"] }, null);
    expect(raw).toContain("Cc: c@b.com");
    const noCc = buildMimeMessage(base, null);
    expect(noCc).not.toContain("Cc:");
  });
});

describe("dryRunSummary", () => {
  it("renders recipients, subject, threading note, and a body preview", () => {
    const summary = dryRunSummary({
      to: ["alice@example.com"],
      subject: "Re: Quote",
      body_text: "Thanks — confirmed for Tuesday.",
      thread_id: "t123",
    });
    expect(summary).toContain("Send email to alice@example.com");
    expect(summary).toContain("Subject: Re: Quote");
    expect(summary).toContain("Threaded reply into the original conversation.");
    expect(summary).toContain("Thanks — confirmed for Tuesday.");
  });
});

describe("auditFields", () => {
  it("captures connector/action and threading identifiers", () => {
    const fields = auditFields({
      to: ["a@b.com"],
      subject: "Hi",
      body_text: "x",
      thread_id: "t1",
      in_reply_to: "<m1@mail>",
    });
    expect(fields).toMatchObject({
      connector: "gmail",
      action: "send",
      to: ["a@b.com"],
      cc: [],
      bcc: [],
      threadId: "t1",
      inReplyTo: "<m1@mail>",
    });
  });
});

describe("execute", () => {
  it("refuses with a file-a-bug message when no recipient survives parsing", async () => {
    const result = await execute({
      accessToken: "tok",
      fromEmail: "owner@example.com",
      input: { to: ["   "], subject: "Hi", body_text: "x" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("recipient missing");
    }
  });
});
