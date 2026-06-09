// classify.ts — trigger detection for the Decision Roundtable (PA-DR-6). Two signals combine: cheap
// heuristic markers (pure regex, free, runs on every message) and a one-token Haiku classifier (fired
// only when the heuristics already smell a decision, so the common chat message costs nothing). The
// classifier returns decision / routine / ambiguous + a confidence the route maps to High / Medium /
// Low bands. It is NOT a hard keyword list — Haiku adapts to the owner's phrasing; the heuristics just
// gate the spend.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import type { DecisionType, StakesLevel } from "./types";

const CLASSIFY_MODEL = "claude-haiku-4-5-20251001"; // cheap — one-word bucket pick

export type DecisionSignal = "decision" | "routine" | "ambiguous";

export type DecisionDetection = {
  signal: DecisionSignal;
  // 0-1. The route bands this: ≥0.85 = inline offer, 0.5-0.85 = /decide only, <0.5 = normal chat.
  confidence: number;
  // True when the heuristic markers fired (used to short-circuit the Haiku call when they didn't).
  heuristicHit: boolean;
  decisionType: DecisionType;
  stakesLevel: StakesLevel;
};

// ── Heuristic markers ──────────────────────────────────────────────────────────────────────

// Decision-question shapes. Deliberately phrase-level (not single words) so "should I" hits but a
// passing "I should email Dana" mostly doesn't. Scored, not boolean, so the gate is tunable.
const DECISION_MARKERS: RegExp[] = [
  /\bshould (?:i|we)\b/i,
  /\b(?:is|will) it worth\b/i,
  /\bworth it\b/i,
  /\bdo (?:i|we) (?:take|accept|sign|hire|fire|drop|raise|cut|buy|acquire)\b/i,
  /\bwhether (?:to|or not)\b/i,
  /\b(?:pros and cons|trade[- ]?offs?|upside|downside)\b/i,
  /\b(?:go|move) forward with\b/i,
  /\bwhich (?:one|option|way|route|path)\b/i,
  /\b(?:raise|cut|lower|drop) (?:my |our |the )?(?:price|prices|rate|rates)\b/i,
  /\b(?:hire|fire|let go|lay off)\b/i,
  /\b(?:take on|walk away from|fire) (?:this |the |a )?(?:client|customer|account|deal)\b/i,
  /\bbig (?:decision|call|bet|risk)\b/i,
  /\bhelp me (?:decide|figure out|think through|weigh)\b/i,
];

// Stakes amplifiers — dollar thresholds + time pressure. Raise confidence and the stakes level.
const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m)?\b|\b\d[\d,]*\s?(?:dollars|grand)\b/i;
const TIME_PRESSURE = /\b(?:by (?:tomorrow|friday|monday|end of|eod|tonight)|this week|deadline|right now|asap|today)\b/i;

// Routine shapes that should NEVER roundtable even if a marker grazes them.
const ROUTINE_MARKERS: RegExp[] = [
  /\bwhat(?:'s| is) my next (?:meeting|appointment|call)\b/i,
  /\b(?:draft|write|send) (?:an? )?(?:email|reply|recap|follow[- ]?up)\b/i,
  /\bwhat time\b/i,
  /\bremind me\b/i,
  /\bsummar(?:ize|y)\b/i,
];

const DECISION_TYPE_MARKERS: Array<[DecisionType, RegExp]> = [
  ["pricing", /\b(?:price|prices|pricing|rate|rates|charge|discount|raise|quote)\b/i],
  ["hiring", /\b(?:hire|hiring|recruit|onboard|new (?:hire|employee|rep))\b/i],
  ["firing", /\b(?:fire|firing|let go|lay off|terminate|drop (?:this |the )?client)\b/i],
  ["acquisition", /\b(?:acquire|acquisition|buy(?:ing)? (?:out|the)|merge|merger|invest in)\b/i],
  ["scope", /\b(?:scope|take on|new (?:service|offering|line)|expand into|add a)\b/i],
];

/** Pure heuristic score: 0-1 plus the detected decision type/stakes. No I/O — unit-tested directly. */
export function scoreDecisionHeuristics(text: string): {
  score: number;
  hit: boolean;
  decisionType: DecisionType;
  stakesLevel: StakesLevel;
} {
  const t = text.trim();
  if (!t) return { score: 0, hit: false, decisionType: "other", stakesLevel: "low" };

  const routineHits = ROUTINE_MARKERS.filter((re) => re.test(t)).length;
  const decisionHits = DECISION_MARKERS.filter((re) => re.test(t)).length;
  const hasMoney = MONEY.test(t);
  const hasTime = TIME_PRESSURE.test(t);

  // A clearly routine ask with no decision marker is out.
  if (decisionHits === 0) {
    return { score: 0, hit: false, decisionType: "other", stakesLevel: "low" };
  }

  let score = Math.min(0.6, 0.3 + decisionHits * 0.18);
  if (hasMoney) score += 0.15;
  if (hasTime) score += 0.1;
  // Routine markers pull it back down — "should I just send the recap email" is not a roundtable.
  score -= routineHits * 0.25;
  score = Math.max(0, Math.min(1, score));

  const decisionType = DECISION_TYPE_MARKERS.find(([, re]) => re.test(t))?.[0] ?? "other";
  const stakesLevel: StakesLevel = hasMoney && hasTime ? "high" : hasMoney || hasTime ? "medium" : "low";

  return { score, hit: score > 0.15, decisionType, stakesLevel };
}

// ── Haiku classifier ────────────────────────────────────────────────────────────────────────

const CLASSIFY_PROMPT =
  "You classify a small-business owner's chat message by SHAPE, for whether it warrants a structured " +
  "multi-agent decision debate. Reply with EXACTLY one word:\n" +
  "- decision: a high-stakes judgment call with real trade-offs (pricing, hiring, firing, taking/dropping " +
  "a client, a big bet, an irreversible move).\n" +
  "- routine: a task or lookup (draft an email, what's my next meeting, summarize this, remind me).\n" +
  "- ambiguous: a question that could go either way.\n" +
  "Reply with only the single word, lowercase.";

function parseSignal(raw: string): DecisionSignal {
  const w = raw.trim().toLowerCase();
  if (w.startsWith("decision")) return "decision";
  if (w.startsWith("routine")) return "routine";
  return "ambiguous";
}

/**
 * Full trigger detection: heuristics first (free), then a Haiku confirm only when they fire. Combines
 * both into a final confidence. Degrades to the heuristic result on any classifier failure (never
 * throws, never blocks the chat turn).
 */
export async function detectDecision(
  text: string,
  apiKey: string | null,
  cost?: CostContext,
): Promise<DecisionDetection> {
  const h = scoreDecisionHeuristics(text);

  // Heuristics saw nothing decision-shaped → normal chat, zero classifier spend.
  if (!h.hit || !apiKey) {
    return {
      signal: h.score >= 0.5 ? "decision" : "routine",
      confidence: h.score,
      heuristicHit: h.hit,
      decisionType: h.decisionType,
      stakesLevel: h.stakesLevel,
    };
  }

  let signal: DecisionSignal = "ambiguous";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        max_tokens: 8,
        system: CLASSIFY_PROMPT,
        messages: [{ role: "user", content: text.slice(0, 2_000) }],
      }),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const word = data.content?.find((c) => c.type === "text")?.text ?? "";
      signal = parseSignal(word);
      if (cost) {
        await logCostFromUsage(cost, "anthropic", CLASSIFY_MODEL, {
          tokensInput: data.usage?.input_tokens ?? 0,
          tokensOutput: data.usage?.output_tokens ?? 0,
        });
      }
    } else {
      // A failed classify falls back to the heuristic read rather than blocking — don't throw.
      signal = h.score >= 0.6 ? "decision" : "ambiguous";
    }
  } catch {
    signal = h.score >= 0.6 ? "decision" : "ambiguous";
  }

  // Combine: the Haiku verdict moves the heuristic score toward a band. A 'decision' confirm pushes it
  // over the High threshold; 'routine' collapses it; 'ambiguous' keeps it in the Medium band.
  let confidence = h.score;
  if (signal === "decision") confidence = Math.max(0.85, h.score);
  else if (signal === "routine") confidence = Math.min(0.4, h.score);
  else confidence = Math.min(0.84, Math.max(0.5, h.score));

  return {
    signal,
    confidence,
    heuristicHit: true,
    decisionType: h.decisionType,
    stakesLevel: h.stakesLevel,
  };
}
