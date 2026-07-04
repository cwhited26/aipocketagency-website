// /app/apps/agent-builder — PA-POS-37: the compose surface for a signed-in owner lives at
// /app/agents (the authenticated mirror of the marketing Library, amending PA-POS-34's
// redirect to the public /agents). The tile stays in the catalog for muscle memory and deep
// links; this route forwards them, spec riding along, so every old link (onboarding chip,
// slash commands, bookmarks) lands on the workspace create surface.

import { redirect } from "next/navigation";

export default function AgentBuilderRedirect({
  searchParams,
}: {
  searchParams: { spec?: string; prefill?: string };
}) {
  // Slash-command args arrive as ?prefill=; the homepage hero used ?spec=. Both forward.
  const spec = searchParams.spec ?? searchParams.prefill;
  const trimmed = typeof spec === "string" ? spec.slice(0, 4_000) : "";
  redirect(
    trimmed ? `/app/agents?spec=${encodeURIComponent(trimmed)}#compose` : "/app/agents#compose",
  );
}
