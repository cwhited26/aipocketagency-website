// lib/emails/render.ts — the shared render layer for the onboarding + retention email system
// (GTM Phase 3). Every template in src/lib/emails/templates/** is a small data function that calls
// composeEmail() here; this file owns the single look-and-feel, the footer (sender + unsubscribe +
// physical-address CAN-SPAM line), the HMAC unsubscribe token, and the plaintext fallback.
//
// Direct-string HTML, no React Email / no templating library — matches the existing Resend pattern
// in src/lib/resend.ts and the inline HTML in the Stripe webhook (standing rule: match what's there).
//
// Sender note: per the GTM Phase 3 brief the sender is chase@aipocketagent.com (the 't' domain, the
// canonical product domain). The legacy system-mail lane (lib/email/resend.ts) sends from the 'cy'
// domain because that's what was verified on Resend at the time; if aipocketagent.com is not yet a
// verified Resend sending domain these will not deliver — that's a Chase infra to-do, flagged in the
// ship report, NOT a reason to put the banned 'cy' domain in customer-facing copy.

import { createHmac, timingSafeEqual } from "node:crypto";

export const EMAIL_FROM = "Pocket Agent <chase@aipocketagent.com>";

/** The reply-to / contact address shown in the footer. */
export const EMAIL_CONTACT = "chase@aipocketagent.com";

export const SITE_ORIGIN = "https://aipocketagent.com";

/** App origin — login + in-app deep links. The product app is reached at the apex domain /app. */
export const APP_ORIGIN = "https://aipocketagent.com";

// CAN-SPAM requires a valid physical postal address in commercial mail. Placeholder until Chase sets
// EMAIL_PHYSICAL_ADDRESS; kept descriptive so it never ships an invented street address.
const DEFAULT_PHYSICAL_ADDRESS = "Pocket Agent · Tennessee, USA";

export function physicalAddress(): string {
  return process.env.EMAIL_PHYSICAL_ADDRESS?.trim() || DEFAULT_PHYSICAL_ADDRESS;
}

export type RenderedEmail = { subject: string; html: string; text: string };

/** A template is a pure data function: typed props in, rendered email out. */
export type EmailTemplate<P> = (props: P) => RenderedEmail;

// ── Unsubscribe token ────────────────────────────────────────────────────────────────────────────
//
// The unsubscribe link carries an HMAC of the lowercased recipient email so the /unsubscribe POST can
// verify the request came from a link we sent (not a forged email param). Secret: EMAIL_UNSUBSCRIBE_SECRET.

function unsubscribeSecret(): string {
  // Falls back to a fixed dev string so render never throws in tests / local; production MUST set the env
  // (flagged in the ship report). A wrong/missing secret only weakens the unsubscribe link, never leaks data.
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || "pa-dev-unsubscribe-secret";
}

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string): string {
  const params = new URLSearchParams({ email, token: unsubscribeToken(email) });
  return `${SITE_ORIGIN}/unsubscribe?${params.toString()}`;
}

// ── Block model ──────────────────────────────────────────────────────────────────────────────────
//
// Templates describe their body as an ordered list of blocks. composeEmail renders each block to both
// HTML and plaintext so a template is authored once and never drifts between the two formats.

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "button"; label: string; href: string }
  | { kind: "spacer" };

export const p = (text: string): EmailBlock => ({ kind: "p", text });
export const h = (text: string): EmailBlock => ({ kind: "h", text });
export const bullets = (items: string[]): EmailBlock => ({ kind: "bullets", items });
export const button = (label: string, href: string): EmailBlock => ({ kind: "button", label, href });

// Minimal HTML-escape for interpolated copy. The GPT source has no HTML in it; this guards the dynamic
// bits (first name, insert fields) against an accidental angle bracket breaking the markup.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LINK = "#6ee7b7";

function blockHtml(b: EmailBlock): string {
  switch (b.kind) {
    case "p":
      return `<p style="margin:0 0 16px;">${esc(b.text)}</p>`;
    case "h":
      return `<p style="margin:24px 0 12px;font-size:18px;font-weight:600;">${esc(b.text)}</p>`;
    case "bullets":
      return `<ul style="margin:0 0 16px;padding-left:20px;">${b.items
        .map((i) => `<li style="margin:0 0 6px;">${esc(i)}</li>`)
        .join("")}</ul>`;
    case "button":
      return `<p style="margin:24px 0;"><a href="${esc(b.href)}" style="display:inline-block;background:${LINK};color:#0b0b0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">${esc(
        b.label,
      )}</a></p>`;
    case "spacer":
      return `<div style="height:8px;"></div>`;
  }
}

function blockText(b: EmailBlock): string {
  switch (b.kind) {
    case "p":
      return b.text;
    case "h":
      return b.text.toUpperCase();
    case "bullets":
      return b.items.map((i) => `- ${i}`).join("\n");
    case "button":
      return `${b.label}: ${b.href}`;
    case "spacer":
      return "";
  }
}

export type ComposeInput = {
  /** The recipient — used to build the unsubscribe link in the footer. */
  recipientEmail: string;
  subject: string;
  blocks: EmailBlock[];
  /**
   * Transactional mail (purchase / cancellation confirmations) bypasses the marketing-unsubscribe
   * suppression at send time, and its footer says so. Defaults to false (marketing/onboarding).
   */
  transactional?: boolean;
};

function footerHtml(recipientEmail: string, transactional: boolean): string {
  const unsub = transactional
    ? `<p style="margin:0 0 6px;">This is a transactional message about your Pocket Agent account.</p>`
    : `<p style="margin:0 0 6px;"><a href="${esc(
        unsubscribeUrl(recipientEmail),
      )}" style="color:#8a8a8a;">Unsubscribe from onboarding &amp; marketing emails</a> — you'll still get account and billing messages.</p>`;
  return `<div style="margin-top:36px;padding-top:16px;border-top:1px solid #2a2a2a;font-size:13px;line-height:1.5;color:#8a8a8a;">
<p style="margin:0 0 6px;">&mdash; Chase · ${esc(EMAIL_CONTACT)}</p>
${unsub}
<p style="margin:0;">${esc(physicalAddress())}</p>
</div>`;
}

function footerText(recipientEmail: string, transactional: boolean): string {
  const unsub = transactional
    ? "This is a transactional message about your Pocket Agent account."
    : `Unsubscribe from onboarding & marketing emails (you'll still get account and billing messages): ${unsubscribeUrl(
        recipientEmail,
      )}`;
  return `— Chase · ${EMAIL_CONTACT}
${unsub}
${physicalAddress()}`;
}

export function composeEmail(input: ComposeInput): RenderedEmail {
  const transactional = input.transactional ?? false;
  const bodyHtml = input.blocks.map(blockHtml).join("\n");
  const bodyText = input.blocks
    .map(blockText)
    .filter((s) => s.length > 0)
    .join("\n\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#0b0b0b;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:560px;margin:0 auto;">
${bodyHtml}
${footerHtml(input.recipientEmail, transactional)}
</div>
</body></html>`;

  const text = `${bodyText}

${footerText(input.recipientEmail, transactional)}`;

  return { subject: input.subject, html, text };
}

/** Greeting helper — "Hey {name} —" or "Hey —" when no name. Shared by every template. */
export function greeting(firstName?: string | null): string {
  const n = firstName?.trim();
  return n ? `Hey ${n} —` : "Hey —";
}
