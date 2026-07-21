// brief.ts — the 3-line prospect brief writer (SPEC §4.3).
//
// For each shortlisted prospect, PA writes a 3-line brief: (a) what this person does + one distinctive
// detail from the enrichment snapshot, (b) why they might care about the owner's offer (grounded in
// the ICP + any activity signal), (c) a mutual-connection hook if there is one. The write rides the
// shared metered LLM (llm.ts, sub-slug linkedin_scout_research) and the result is voice-scanned so a
// slop brief never lands unflagged. Never invents facts about the prospect — the prompt binds every
// claim to the snapshot.

import { scanVoiceViolations, summarizeViolations } from "./voice";
import type { CompleteFn } from "./llm";
import type { EnrichmentSignals } from "./types";

const BRIEF_MAX_TOKENS = 500;

export type BriefInput = {
  fullName: string;
  headline: string;
  company: string;
  signals: EnrichmentSignals;
  /** The raw enrichment snapshot — extra true detail the writer may cite, never invent beyond. */
  snapshot: Record<string, unknown>;
  /** What the owner sells / their ICP, loaded from the brain (voice + offer). Empty when no brain. */
  brainContext: string;
};

/** Flatten the snapshot to labelled lines the model can read (skip empties + nested noise). */
function snapshotLines(snapshot: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue; // keep it to scalar signals — the model gets the structured ones below
    lines.push(`- ${k}: ${String(v)}`);
  }
  return lines.join("\n");
}

export function buildBriefPrompt(input: BriefInput): { system: string; user: string } {
  const system = [
    "You are Pocket Agent writing a 3-line prospect brief for an operator about to reach out on LinkedIn.",
    "Write EXACTLY three lines, each one sentence, no bullets, no preamble:",
    "Line 1 — what this person does + ONE distinctive, true detail from the profile below.",
    "Line 2 — why they might care about the operator's offer, grounded in the operator's brain + any activity signal.",
    "Line 3 — a mutual-connection hook if the profile shows one; otherwise a specific, honest opener angle.",
    "Never invent facts about the prospect. If the profile doesn't say it, don't claim it.",
    "Write like the operator talks: short, direct, specific. No corporate filler, no 'I hope this finds you well', no hype words.",
  ].join(" ");

  const signalLines: string[] = [];
  if (input.signals.title) signalLines.push(`- title: ${input.signals.title}`);
  if (input.signals.seniority) signalLines.push(`- seniority: ${input.signals.seniority}`);
  if (input.signals.industry) signalLines.push(`- industry: ${input.signals.industry}`);
  if (input.signals.companySize) signalLines.push(`- company size: ${input.signals.companySize}`);
  if (input.signals.location) signalLines.push(`- location: ${input.signals.location}`);
  if (input.signals.recentJobMove) signalLines.push("- recently changed jobs");
  if (input.signals.recentPostActivity) signalLines.push("- recently active / posting");
  if (typeof input.signals.mutualConnections === "number" && input.signals.mutualConnections > 0)
    signalLines.push(`- mutual connections: ${input.signals.mutualConnections}`);

  const user = [
    input.brainContext
      ? `THE OPERATOR'S BRAIN (what they sell, their voice, their ICP):\n${input.brainContext}\n`
      : "NOTE: No brain connected yet — write the best brief you can from the profile, and keep the offer angle generic.\n",
    `PROSPECT: ${input.fullName || "(name unknown)"}`,
    `HEADLINE: ${input.headline || "(none)"}`,
    `COMPANY: ${input.company || "(none)"}`,
    signalLines.length ? `SIGNALS:\n${signalLines.join("\n")}` : "SIGNALS: (sparse)",
    snapshotLines(input.snapshot) ? `MORE:\n${snapshotLines(input.snapshot)}` : "",
    "Write the 3-line brief now. Three lines, nothing else.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export type BriefResult = { brief: string; voiceFlags: string };

/**
 * Generate one prospect's brief. Voice-scans the result and carries a voice_flags string when it trips
 * a rule (the brief is informational, not a send, so we flag rather than retry — the two-strike retry
 * is reserved for the drafts that actually go out). Returns an empty brief + a flag on LLM failure so
 * the prospect still stages (the owner can re-run research).
 */
export async function writeBrief(input: BriefInput, complete: CompleteFn, cost: {
  ownerId: string;
  idempotencyKey: string;
}): Promise<BriefResult> {
  const { system, user } = buildBriefPrompt(input);
  const res = await complete({
    system,
    user,
    maxTokens: BRIEF_MAX_TOKENS,
    cost: { ownerId: cost.ownerId, featureSlug: "linkedin_scout", idempotencyKey: cost.idempotencyKey, metadata: { sub_slug: "linkedin_scout_research" } },
  });
  if (!res.ok) return { brief: "", voiceFlags: `research_failed: ${res.error}`.slice(0, 200) };
  const brief = res.text.trim();
  const violations = scanVoiceViolations(brief);
  return { brief, voiceFlags: summarizeViolations(violations) };
}
