// /app/apps/agent-builder — PA-POS-34: the compose surface moved to the /agents Library
// (#compose), Twin-parity — the builder is the primary create surface, not an App page behind
// a tile. The tile stays in the catalog for muscle memory and deep links; this route forwards
// them, spec riding along, so every old link (marketing, slash commands, bookmarks) lands on
// the real create surface.

import { redirect } from "next/navigation";

export default function AgentBuilderRedirect({
  searchParams,
}: {
  searchParams: { spec?: string; prefill?: string };
}) {
  // Slash-command args arrive as ?prefill=; the homepage hero used ?spec=. Both forward.
  const spec = searchParams.spec ?? searchParams.prefill;
  const trimmed = typeof spec === "string" ? spec.slice(0, 4_000) : "";
  redirect(trimmed ? `/agents?spec=${encodeURIComponent(trimmed)}#compose` : "/agents#compose");
}
