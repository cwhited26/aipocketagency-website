import { SKOOL_URL } from "@/lib/constants/skool";

// Stable internal target for the Pocket Agent Launchpad. Email templates and legacy CTAs link to
// `/skool-invite`; this 308-redirects to the real Skool community URL (SKOOL_URL) so the destination
// stays a one-line change. 308 preserves the method and tells crawlers the move is permanent.
// (The `/skool-invite/[session_id]` pitch page is a deeper segment and is unaffected by this handler.)
export const runtime = "nodejs";

export function GET(): Response {
  return Response.redirect(SKOOL_URL, 308);
}
