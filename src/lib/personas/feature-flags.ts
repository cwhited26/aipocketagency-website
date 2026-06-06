// feature-flags.ts — Wave 2 (Modes B + C) ship behind a single hard gate. Public-link
// and widget surfaces carry anonymous-traffic risk (prompt injection, cross-zone
// extraction, cost abuse), so they stay dark until adversarial testing clears them.
//
// Every public/widget request path AND the owner-facing Mode toggle UI check this flag
// at request time. Default (unset) = OFF → the routes return 503 "coming soon". Chase
// flips PA_PERSONAS_PUBLIC_MODES_ENABLED=true on Vercel only after the §8 post-engagement
// gate of the adversarial brief is cleared.

import { NextResponse } from "next/server";

/** True only when the operator has explicitly enabled public + widget modes. */
export function publicModesEnabled(): boolean {
  return process.env.PA_PERSONAS_PUBLIC_MODES_ENABLED === "true";
}

export const PUBLIC_MODES_COMING_SOON =
  "Public personas are launching after adversarial testing completes. " +
  "Watch your Pocket Agent inbox for the go-live notice.";

/** Standard 503 returned by every gated route when the flag is unset. */
export function comingSoon503(): NextResponse {
  return NextResponse.json(
    { error: PUBLIC_MODES_COMING_SOON, comingSoon: true },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
