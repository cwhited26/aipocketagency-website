// parse.ts — normalize the Resend inbound-email webhook payload into the one shape both
// handlers (@inbound forwarding + @bcc awareness) consume, and the pure address-routing
// helpers that decide which owner + verb a message is for.
//
// Resend's inbound payload nests the RFC822 fields under `data`. We validate defensively
// (zod at the boundary): `to` may be a string or array, headers may be an array of
// {name,value} or a flat record, and attachments carry base64 `content`. Everything is
// coerced to a single ParsedInboundEmail with bare lowercased addresses.

import { z } from "zod";

// ── Domains (envelope routing) ────────────────────────────────────────────────
// The forwarding ("act on this") and BCC ("be aware") subdomains. Overridable per
// environment; defaults are the production subdomains on the canonical web domain.
export const INBOUND_DOMAIN = (
  process.env.PA_INBOUND_EMAIL_DOMAIN ?? "inbound.aipocketagent.com"
).toLowerCase();
export const BCC_DOMAIN = (
  process.env.PA_BCC_EMAIL_DOMAIN ?? "bcc.aipocketagent.com"
).toLowerCase();

export type AddressKind = "inbound" | "bcc";

export type ParsedAttachment = {
  filename: string;
  contentType: string;
  /** base64-encoded bytes. */
  content: string;
};

export type ParsedInboundEmail = {
  /** Bare lowercased sender address (display name stripped). */
  fromAddr: string;
  /** The raw From header (may include a display name). */
  fromRaw: string;
  /** Every recipient address, bare + lowercased (To, plus the envelope recipient). */
  toAddrs: string[];
  subject: string;
  text: string;
  html: string;
  /** RFC 2822 Message-ID of this message. */
  messageId: string;
  /** In-Reply-To header value, when this message is itself a reply. */
  inReplyTo: string;
  attachments: ParsedAttachment[];
};

// ── Raw payload schema (defensive) ─────────────────────────────────────────────

const HeaderArraySchema = z.array(z.object({ name: z.string(), value: z.string() }));
const HeaderRecordSchema = z.record(z.string(), z.string());

const AttachmentSchema = z.object({
  filename: z.string().optional(),
  // Resend uses content_type; tolerate contentType too.
  content_type: z.string().optional(),
  contentType: z.string().optional(),
  content: z.string().optional(),
});

const InboundDataSchema = z.object({
  from: z.union([z.string(), z.object({ address: z.string().optional(), name: z.string().optional() })]).optional(),
  to: z.union([z.string(), z.array(z.string()), z.array(z.object({ address: z.string() }))]).optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  headers: z.union([HeaderArraySchema, HeaderRecordSchema]).optional(),
  message_id: z.string().optional(),
  messageId: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

const WebhookSchema = z.object({
  type: z.string().optional(),
  data: InboundDataSchema,
});

// ── Pure address helpers ───────────────────────────────────────────────────────

/** Pull the bare email out of a "Display Name <email@host>" (or plain) string, lowercased. */
export function extractEmailAddress(raw: string): string {
  const angle = raw.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : raw).trim().toLowerCase();
  // Guard against stray whitespace / multiple tokens.
  const token = candidate.split(/\s+/).pop() ?? candidate;
  return token.replace(/^mailto:/, "");
}

/** Split an address into its local-part and domain (both lowercased). */
export function localPartAndDomain(addr: string): { localPart: string; domain: string } {
  const at = addr.lastIndexOf("@");
  if (at === -1) return { localPart: addr.toLowerCase(), domain: "" };
  return { localPart: addr.slice(0, at).toLowerCase(), domain: addr.slice(at + 1).toLowerCase() };
}

/**
 * Decide whether an address belongs to one of our inbound subdomains. Returns the verb
 * (kind) and the <owner> local-part, or null when it's an unrelated address. Gmail-style
 * plus-tags are stripped from the local-part so foo+ref@inbound… still resolves to "foo".
 */
export function classifyAddress(
  addr: string,
  inboundDomain = INBOUND_DOMAIN,
  bccDomain = BCC_DOMAIN,
): { kind: AddressKind; localPart: string } | null {
  const { localPart, domain } = localPartAndDomain(addr);
  const cleanLocal = localPart.split("+")[0];
  if (!cleanLocal) return null;
  if (domain === inboundDomain) return { kind: "inbound", localPart: cleanLocal };
  if (domain === bccDomain) return { kind: "bcc", localPart: cleanLocal };
  return null;
}

/**
 * Find the recipient that routed this message to us. Scans every To/envelope recipient,
 * returns the first that lands on an inbound subdomain. Null when none do (shouldn't
 * happen for a correctly-routed webhook, but we never assume).
 */
export function routedRecipient(
  email: ParsedInboundEmail,
  inboundDomain = INBOUND_DOMAIN,
  bccDomain = BCC_DOMAIN,
): { kind: AddressKind; localPart: string; address: string } | null {
  for (const addr of email.toAddrs) {
    const classified = classifyAddress(addr, inboundDomain, bccDomain);
    if (classified) return { ...classified, address: addr };
  }
  return null;
}

// ── Header extraction ──────────────────────────────────────────────────────────

function headerValue(
  headers: z.infer<typeof HeaderArraySchema> | z.infer<typeof HeaderRecordSchema> | undefined,
  name: string,
): string {
  if (!headers) return "";
  const lower = name.toLowerCase();
  if (Array.isArray(headers)) {
    return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return "";
}

// ── Top-level parse ──────────────────────────────────────────────────────────────

export type ParseResult =
  | { ok: true; email: ParsedInboundEmail }
  | { ok: false; error: string };

/** Validate + normalize a raw Resend inbound webhook body (already JSON-parsed). */
export function parseInboundWebhook(raw: unknown): ParseResult {
  const parsed = WebhookSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `inbound payload shape invalid: ${parsed.error.message}` };
  const data = parsed.data.data;

  const fromRaw =
    typeof data.from === "string" ? data.from : data.from?.address ?? "";
  const fromAddr = extractEmailAddress(fromRaw);

  const toAddrs: string[] = [];
  if (typeof data.to === "string") {
    for (const part of data.to.split(",")) {
      const addr = extractEmailAddress(part);
      if (addr) toAddrs.push(addr);
    }
  } else if (Array.isArray(data.to)) {
    for (const entry of data.to) {
      const addr = extractEmailAddress(typeof entry === "string" ? entry : entry.address);
      if (addr) toAddrs.push(addr);
    }
  }

  // A BCC recipient is stripped from the To header — it survives only as the SMTP envelope
  // recipient, surfaced by most parsers as Delivered-To / X-Original-To. Fold those in so the
  // <owner>@bcc address routes correctly even though it never appears in the visible To.
  for (const name of ["Delivered-To", "X-Original-To", "X-Forwarded-To"]) {
    const headerAddr = extractEmailAddress(headerValue(data.headers, name));
    if (headerAddr && !toAddrs.includes(headerAddr)) toAddrs.push(headerAddr);
  }

  const messageId = (data.message_id ?? data.messageId ?? headerValue(data.headers, "Message-ID")).trim();
  const inReplyTo = headerValue(data.headers, "In-Reply-To").trim();

  const attachments: ParsedAttachment[] = (data.attachments ?? [])
    .filter((a) => typeof a.content === "string" && a.content.length > 0)
    .map((a) => ({
      filename: a.filename ?? "attachment",
      contentType: a.content_type ?? a.contentType ?? "application/octet-stream",
      content: a.content ?? "",
    }));

  return {
    ok: true,
    email: {
      fromAddr,
      fromRaw: fromRaw.trim(),
      toAddrs,
      subject: data.subject ?? "",
      text: data.text ?? "",
      html: data.html ?? "",
      messageId,
      inReplyTo,
      attachments,
    },
  };
}
