import { describe, it, expect } from "vitest";
import {
  extractEmailAddress,
  classifyAddress,
  localPartAndDomain,
  parseInboundWebhook,
  routedRecipient,
} from "../parse";

const INBOUND = "inbound.aipocketagent.com";
const BCC = "bcc.aipocketagent.com";

describe("extractEmailAddress", () => {
  it("pulls the bare address from a display-name form", () => {
    expect(extractEmailAddress("Alan Stoll <alan@stoll.com>")).toBe("alan@stoll.com");
  });
  it("lowercases and trims a plain address", () => {
    expect(extractEmailAddress("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it("strips a mailto prefix", () => {
    expect(extractEmailAddress("mailto:x@y.com")).toBe("x@y.com");
  });
});

describe("localPartAndDomain", () => {
  it("splits on the last @", () => {
    expect(localPartAndDomain("a.b@inbound.aipocketagent.com")).toEqual({
      localPart: "a.b",
      domain: "inbound.aipocketagent.com",
    });
  });
});

describe("classifyAddress", () => {
  it("recognizes the inbound subdomain", () => {
    expect(classifyAddress(`chase@${INBOUND}`)).toEqual({ kind: "inbound", localPart: "chase" });
  });
  it("recognizes the bcc subdomain", () => {
    expect(classifyAddress(`chase@${BCC}`)).toEqual({ kind: "bcc", localPart: "chase" });
  });
  it("strips a plus tag from the local-part", () => {
    expect(classifyAddress(`chase+ref@${INBOUND}`)).toEqual({ kind: "inbound", localPart: "chase" });
  });
  it("returns null for an unrelated domain", () => {
    expect(classifyAddress("chase@gmail.com")).toBeNull();
  });
});

describe("parseInboundWebhook", () => {
  it("normalizes a forwarding payload with array recipients + headers + attachment", () => {
    const raw = {
      type: "email.received",
      data: {
        from: "Owner <owner@example.com>",
        to: [`chase@${INBOUND}`],
        subject: "Fwd: roof quote",
        text: "Can you handle this?",
        headers: [{ name: "Message-ID", value: "<abc@mail>" }],
        attachments: [{ filename: "quote.pdf", content_type: "application/pdf", content: "QkFTRTY0" }],
      },
    };
    const result = parseInboundWebhook(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email.fromAddr).toBe("owner@example.com");
    expect(result.email.toAddrs).toContain(`chase@${INBOUND}`);
    expect(result.email.messageId).toBe("<abc@mail>");
    expect(result.email.attachments).toHaveLength(1);
    expect(result.email.attachments[0].contentType).toBe("application/pdf");

    const routed = routedRecipient(result.email);
    expect(routed).toEqual({ kind: "inbound", localPart: "chase", address: `chase@${INBOUND}` });
  });

  it("routes a BCC via the Delivered-To header when the address isn't in the visible To", () => {
    const raw = {
      data: {
        from: "owner@example.com",
        to: "client@acme.com",
        subject: "Proposal",
        text: "Here's the proposal.",
        headers: { "Delivered-To": `chase@${BCC}`, "Message-ID": "<m1@x>" },
      },
    };
    const result = parseInboundWebhook(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email.toAddrs).toContain("client@acme.com");
    const routed = routedRecipient(result.email);
    expect(routed?.kind).toBe("bcc");
    expect(routed?.localPart).toBe("chase");
    // The external recipient (the person the owner emailed) is still present for the watch.
    expect(result.email.toAddrs.some((a) => a === "client@acme.com")).toBe(true);
  });

  it("returns null routing when no recipient is on our domains", () => {
    const result = parseInboundWebhook({ data: { to: "x@y.com", subject: "hi" } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(routedRecipient(result.email)).toBeNull();
  });
});
