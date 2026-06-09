// roles.ts — the role system prompts that make three (or four) sub-agents actually disagree, plus the
// Moderator's verdict prompt. Pure string-building, no I/O, so the prompts are unit-tested directly.
//
// PA-DR-2/3: the Steel-man argues the strongest case FOR, the Devil's Advocate the strongest case
// AGAINST, the optional Domain Specialist adds vertical framing, and the Moderator synthesizes. When
// model diversity is available the role prompts ride different providers; when it isn't, the prompts
// themselves have to carry the disagreement — so they're written to demand a committed position, not a
// balanced both-sides take.

import type { ArguingRole, RoundtableRole, Verdict } from "./types";
import { ROLE_LABELS } from "./types";

const SHARED_PREAMBLE =
  "You are one voice in the owner's Decision Roundtable — a structured debate that helps a small-business " +
  "owner make a high-stakes call. The brain context below is what the agent knows about THIS owner's " +
  "business: their voice, decisions, customers, and competitive picture. Ground every claim in it where " +
  "you can, and cite the file you leaned on inline like [memory/pricing.md]. Never invent facts about the " +
  "business — if the brain doesn't say, argue from the general case and flag the gap. Write like a sharp " +
  "operator talking at a coffee table: short declarative sentences, the claim before the why, no preamble, " +
  "no padded summary. Keep it under 220 words.";

const ROLE_INSTRUCTIONS: Record<ArguingRole, string> = {
  steelman:
    "Your job is the STRONGEST possible case FOR the proposed action — the most defensible argument for " +
    "'yes, do it'. Do not hedge into both-sides. Take the position and make it as hard to refute as you " +
    "can: name the upside, the evidence in the brain that supports it, and the cost of NOT acting. You are " +
    "allowed to concede a single risk only if you immediately show why it's worth taking.",
  devils_advocate:
    "Your job is the STRONGEST possible case AGAINST the proposed action — the most defensible argument for " +
    "'no, don't' (or 'not like this'). Do not hedge into both-sides. Find the failure mode the owner is " +
    "underweighting: the downside risk, the relationship cost, the brain evidence that cuts against it, the " +
    "cheaper alternative. Attack the Steel-man's strongest point directly when you see it in the transcript.",
  domain_specialist:
    "You are a specialist in this owner's vertical. Add the framing a generalist would miss: how operators in " +
    "this trade actually handle this call, the norm the owner is measured against, the specific number or " +
    "timing convention that matters here. Pull from the influence material in the brain context. Don't just " +
    "pick a side — sharpen the debate with vertical-specific reality the other two can't supply.",
};

export type ArgPromptInput = {
  question: string;
  brainContext: string;
  // The transcript of all prior turns (empty on round 1). Each turn is "Steel-man (round 1): …".
  transcript: string;
  // The owner's latest interjection folded into this round, when any.
  interjection: string | null;
  // For the Domain Specialist only — the vertical the question matched.
  vertical?: string | null;
};

/** Builds the system prompt for one arguing role on one round. */
export function buildArgSystemPrompt(role: ArguingRole, vertical?: string | null): string {
  const roleLine = ROLE_INSTRUCTIONS[role];
  const verticalLine =
    role === "domain_specialist" && vertical
      ? `\n\nThe matched vertical is: ${vertical}. Frame your contribution for that trade specifically.`
      : "";
  return `${SHARED_PREAMBLE}\n\nYOUR ROLE — ${ROLE_LABELS[role]}.\n${roleLine}${verticalLine}`;
}

/** Builds the user-turn content for one arguing role on one round (question + brain + transcript). */
export function buildArgUserPrompt(input: ArgPromptInput): string {
  const parts: string[] = [];
  parts.push(`THE QUESTION ON THE TABLE:\n${input.question}`);
  parts.push(
    `WHAT THE AGENT KNOWS ABOUT THIS BUSINESS (brain context):\n${input.brainContext || "(no brain context available — argue from the general case and say so)"}`,
  );
  if (input.transcript.trim()) {
    parts.push(`THE DEBATE SO FAR:\n${input.transcript}`);
  } else {
    parts.push("This is the opening round — no prior turns yet. Open with your strongest single argument.");
  }
  if (input.interjection) {
    parts.push(
      `THE OWNER JUST INTERJECTED — fold this into your next argument, it's the most important input:\n${input.interjection}`,
    );
  }
  parts.push("Write your turn now. One position, committed, grounded in the brain where you can.");
  return parts.join("\n\n");
}

// ── Moderator ─────────────────────────────────────────────────────────────────────────────

// Locked output contract so run.ts can parse the verdict deterministically. The Moderator never argues
// — it weighs argument QUALITY + brain-grounding + evidence over confidence or assertion (PA-DR §11
// model-diversity-exploit defense), names the strongest dissent verbatim, and recommends one action.
export const VERDICT_HEADERS = {
  recommendation: "RECOMMENDATION:",
  dissent: "STRONGEST DISSENT:",
  evidence: "SUPPORTING EVIDENCE:",
} as const;

export function buildModeratorSystemPrompt(): string {
  return (
    "You are the Moderator of the owner's Decision Roundtable. You did NOT argue — you read the whole " +
    "debate and deliver a verdict the owner can act on. Weigh each side on the QUALITY of its argument and " +
    "how well it's grounded in the brain context and cited evidence — not on confidence or how forcefully " +
    "it was asserted. If the losing side made a strong point, say so plainly; the owner will see the dissent " +
    "next to your call. Write in a plain operator voice: decisive, specific, no hedging, no padded summary.\n\n" +
    "Return EXACTLY these three sections, each on its own line header, nothing before or after:\n\n" +
    `${VERDICT_HEADERS.recommendation}\nOne clear recommended action and the single strongest reason for it. 2-4 sentences.\n\n` +
    `${VERDICT_HEADERS.dissent}\nThe strongest argument AGAINST your recommendation, stated fairly — the best case the losing side made. 1-3 sentences.\n\n` +
    `${VERDICT_HEADERS.evidence}\nThe brain evidence your call leaned on, with inline citations like [memory/pricing.md]. 1-3 sentences.`
  );
}

export function buildModeratorUserPrompt(input: {
  question: string;
  brainContext: string;
  transcript: string;
}): string {
  return [
    `THE QUESTION:\n${input.question}`,
    `BRAIN CONTEXT:\n${input.brainContext || "(none available)"}`,
    `THE FULL DEBATE:\n${input.transcript}`,
    "Deliver your verdict now, in exactly the three sections specified.",
  ].join("\n\n");
}

/** Parses the Moderator's three-section output into a structured verdict. Tolerant of stray whitespace
 *  and a missing trailing section (falls back to the whole text as the recommendation). */
export function parseVerdict(text: string): Verdict {
  const rec = sliceSection(text, VERDICT_HEADERS.recommendation, [
    VERDICT_HEADERS.dissent,
    VERDICT_HEADERS.evidence,
  ]);
  const dissent = sliceSection(text, VERDICT_HEADERS.dissent, [VERDICT_HEADERS.evidence]);
  const evidence = sliceSection(text, VERDICT_HEADERS.evidence, []);
  return {
    // If the Moderator ignored the format entirely, the whole text is still a usable recommendation.
    recommendation: rec || text.trim(),
    strongestDissent: dissent,
    supportingEvidence: evidence,
  };
}

function sliceSection(text: string, header: string, nextHeaders: string[]): string {
  const start = text.indexOf(header);
  if (start === -1) return "";
  const afterHeader = start + header.length;
  let end = text.length;
  for (const next of nextHeaders) {
    const idx = text.indexOf(next, afterHeader);
    if (idx !== -1 && idx < end) end = idx;
  }
  return text.slice(afterHeader, end).trim();
}

// Renders a turn line for the transcript fed to later rounds + the Moderator.
export function transcriptLine(role: RoundtableRole, roundIndex: number, content: string): string {
  const label = ROLE_LABELS[role];
  const roundTag = role === "owner_interjection" ? "" : ` (round ${roundIndex + 1})`;
  return `${label}${roundTag}:\n${content}`;
}
