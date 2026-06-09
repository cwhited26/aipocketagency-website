// card.ts — the contract for the inline "decision_roundtable_live" card the Ask box renders once an
// owner starts a roundtable. It rides in pocket_agent_messages.metadata (the same untyped-jsonb seam
// the upload/YouTube/podcast cards use); the DecisionRoundtableCard component reads the roundtableId
// from here, then polls /api/app/decisions/<id> for the live turns + verdict. One Zod source of truth
// so a drifted blob fails validation and degrades to a plain bubble instead of crashing the thread.

import { z } from "zod";

export const DECISION_ROUNDTABLE_KIND = "decision_roundtable_live" as const;

export const DecisionRoundtableCardSchema = z.object({
  kind: z.literal(DECISION_ROUNDTABLE_KIND),
  /** The roundtable row this card tracks. The card fetches everything else live by this id. */
  roundtableId: z.string().uuid(),
  /** The owner's question, shown as the card header (also persisted on the row). */
  question: z.string().min(1).max(10_000),
  /** Number of argue-rounds before the Moderator — drives the card's progress read-out. */
  totalRounds: z.number().int().min(1).max(6),
});
export type DecisionRoundtableCardPayload = z.infer<typeof DecisionRoundtableCardSchema>;

/** Safe-parses message.metadata into a roundtable-live card payload, or null if it isn't one. */
export function asDecisionRoundtablePayload(metadata: unknown): DecisionRoundtableCardPayload | null {
  const parsed = DecisionRoundtableCardSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
