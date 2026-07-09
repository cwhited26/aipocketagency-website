// lib/ghl-waitlist/schema.ts — boundary validation for the /for/ghl-agency design-partner
// waitlist form (SPEC v1 §9). Shared by the API route and its tests so the contract can't drift.

import { z } from "zod";

function trimmed(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1).max(max),
  );
}

export const GhlWaitlistSchema = z.object({
  name: trimmed(120),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email().max(254),
  ),
  agencyName: trimmed(160),
  /** Client sub-accounts managed today. The form sends a string; coerce and bound it. */
  clientCount: z.coerce.number().int().min(0).max(10000),
  topFrustration: trimmed(2000),
  /** Where the visitor came from (document.referrer) — optional, best-effort. */
  referrer: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(500).optional().default(""),
  ),
});

export type GhlWaitlistEntry = z.infer<typeof GhlWaitlistSchema>;
