// lib/constants/skool.ts — single source of truth for the Pocket Agent Launchpad (Skool community) URL.
//
// The Skool group lives at the PLURAL "aipocketagency" slug — intentionally distinct from the
// website/sender domain "aipocketagent.com" (singular "agent"). Both spellings are canonical for
// their respective surfaces; do NOT find/replace one to match the other.
//
// Every "Join the Launchpad" CTA (marketing, in-app, email) and the `/skool-invite` redirect read
// from here, so changing the destination is a one-line edit (or set NEXT_PUBLIC_SKOOL_URL). If Chase
// ever pays Skool the $100 to rename the group, set NEXT_PUBLIC_SKOOL_URL on Vercel — no code change.
export const SKOOL_URL =
  process.env.NEXT_PUBLIC_SKOOL_URL ?? "https://www.skool.com/aipocketagency";
