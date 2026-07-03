// phone.ts — PII-safe sender handling for the cold-onboarding funnel (PA-POS-32). The raw
// WhatsApp number is stored only in pa_trial_threads / pa_moderation_events (service-role
// tables); every log line correlates on this one-way hash instead.

import crypto from "node:crypto";

/** Stable 12-hex-char correlation handle for a sender phone. One-way; log-safe. */
export function hashPhoneForLog(phone: string): string {
  return crypto.createHash("sha256").update(phone.trim(), "utf8").digest("hex").slice(0, 12);
}
