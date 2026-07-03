// config.ts — the PA public WhatsApp number's env surface (PA-POS-32 §22.4/§22.5).
//
// The public number is a SEPARATE Cloud API number from any customer pairing: it handles cold
// onboarding only (the §22.4 number cap). Its Phone Number ID routes inbound to the cold
// handler; the display number builds the wa.me deep link on /whatsapp. Both empty until Chase
// finishes Meta Business Verification — the funnel stays dark and the page renders its
// coming-soon fallback.

export type ColdWhatsappConfig = {
  /** Cloud API Phone Number ID of the PA public number (webhook value.metadata.phone_number_id). */
  phoneNumberId: string;
  /** Meta Cloud API access token (shared with Channels Gateway Phase 4 sends). */
  accessToken: string;
  /** App secret for X-Hub-Signature-256 verification (shipped Phase 4 env). */
  appSecret: string;
  /** Anthropic platform key for the compose + moderation + trial-work calls. */
  anthropicKey: string;
};

/** The wa.me display number (digits only), or null — drives the /whatsapp page CTA. */
export function publicWhatsappNumber(): string | null {
  const raw = process.env.PA_PUBLIC_WHATSAPP_NUMBER ?? "";
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length > 0 ? digits : null;
}

/** The full cold-inbound config, or null when any piece is missing (funnel dark). */
export function coldWhatsappConfig(): ColdWhatsappConfig | null {
  const phoneNumberId = process.env.PA_PUBLIC_WHATSAPP_PHONE_NUMBER_ID ?? "";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!phoneNumberId || !accessToken || !appSecret || !anthropicKey) return null;
  return { phoneNumberId, accessToken, appSecret, anthropicKey };
}

/**
 * True iff an inbound delivery belongs to the cold-onboarding number. The route calls this
 * only after the connection lookup missed — a paired connection always wins, so an existing
 * customer's private pairing can never fall into the cold handler (§22.4 number cap).
 */
export function isColdInboundNumber(phoneNumberId: string, config: ColdWhatsappConfig): boolean {
  return phoneNumberId.trim() === config.phoneNumberId;
}
