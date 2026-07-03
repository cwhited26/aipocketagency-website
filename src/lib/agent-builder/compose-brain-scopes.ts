// compose-brain-scopes.ts — §19 step 5: declare which Business Brain zones the composed agent
// may read. The parse step proposes zones; this narrows to the shipped five and adds the two
// implications the intent itself carries: an owner-voice agent must read the voice zone, and
// a drafting agent that talks to customers reads the customers zone. Deterministic.

import { BRAIN_SCOPES, type BrainScope, type ParsedIntent } from "./types";

const CUSTOMER_FACING_CAPABILITIES = new Set([
  "draft_email",
  "follow_up",
  "write_proposal",
  "message_channels",
]);

export function composeBrainScopes(intent: ParsedIntent): BrainScope[] {
  const scopes = new Set<BrainScope>();
  for (const zone of intent.brainZones) {
    if ((BRAIN_SCOPES as readonly string[]).includes(zone)) scopes.add(zone);
  }
  // Writing as the owner requires the owner's voice zone.
  if (intent.voice === "owner") scopes.add("voice");
  // Talking to customers requires knowing who they are.
  if (intent.capabilities.some((c) => CUSTOMER_FACING_CAPABILITIES.has(c))) {
    scopes.add("customers");
  }
  // Stable order: the shipped declaration order, not insertion order.
  return BRAIN_SCOPES.filter((s) => scopes.has(s));
}
