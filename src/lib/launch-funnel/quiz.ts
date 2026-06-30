// lib/launch-funnel/quiz.ts — pure quiz model + state machine for the start.aipocketagent.com
// launch funnel. No Next.js / Supabase / React imports so the step flow, answer encoding, and
// tier-matching are unit-tested without a framework. Quiz state lives entirely in the URL
// (`?answers=0.2.1`), so this module is the single source of truth for parsing and routing it.

import { z } from "zod";

// The three visible funnel tiers (a subset of the SMB ladder's PaidTier). Step 5 maps an answer
// to one of these; the offer page highlights it and the checkout route routes ?tier= from it.
export const FUNNEL_TIERS = ["starter", "pro", "studio_plus"] as const;
export type FunnelTier = (typeof FUNNEL_TIERS)[number];

export interface QuizOption {
  label: string;
  // Only the Step-5 options carry a tier — that's the license-matching question.
  tier?: FunnelTier;
}

export interface QuizStep {
  /** URL slug used in /q/[step]. */
  slug: string;
  /** 0-based index into the answers array. */
  index: number;
  eyebrow: string;
  question: string;
  options: QuizOption[];
}

// The five questions. `index` is the slot each answer occupies in the encoded answers array.
export const QUIZ_STEPS: QuizStep[] = [
  {
    slug: "1",
    index: 0,
    eyebrow: "Step 1 of 5",
    question: "What's eating your week?",
    options: [
      { label: "Drafting the same emails over and over" },
      { label: "Following up on quotes, leads, and proposals" },
      { label: "Building landing pages, content, and marketing assets" },
      { label: "Switching between 10 tools to find what I need" },
    ],
  },
  {
    slug: "2",
    index: 1,
    eyebrow: "Step 2 of 5",
    question: "Where does it break down?",
    options: [
      { label: "I forget what I told who" },
      { label: "My team and I redo the same work" },
      { label: "AI tools don't know my business" },
      { label: "I don't have time to learn 5 new tools" },
    ],
  },
  {
    slug: "3",
    index: 2,
    eyebrow: "Step 3 of 5",
    question: "How fast do you need it to start paying off?",
    options: [
      { label: "This week — I'm bleeding hours" },
      { label: "This month — I want a real workflow" },
      { label: "This quarter — I'm building for scale" },
    ],
  },
  {
    slug: "4",
    index: 3,
    eyebrow: "Step 4 of 5",
    question: "Who else uses your business workflow?",
    options: [
      { label: "Just me" },
      { label: "Me + 1–2 helpers or VAs" },
      { label: "A team of 5–10" },
      { label: "An agency or multi-business operator" },
    ],
  },
  {
    slug: "5",
    index: 4,
    eyebrow: "Step 5 of 5",
    question: "Which sounds closest?",
    options: [
      { label: "Just my personal workflow", tier: "starter" },
      { label: "My business + a couple helpers", tier: "pro" },
      {
        label: "My business runs on it + I deploy agents to clients",
        tier: "studio_plus",
      },
    ],
  },
];

// The funnel flow: five questions with a one-screen affirmation after Step 1 and Step 3 (the
// Linkhiv micro-reassurance pattern). Order is the source of truth for next-step routing.
export const FUNNEL_FLOW = ["1", "r1", "2", "3", "r2", "4", "5"] as const;
export type FunnelSlug = (typeof FUNNEL_FLOW)[number];

export function isReassuranceSlug(slug: string): slug is "r1" | "r2" {
  return slug === "r1" || slug === "r2";
}

export function isFunnelSlug(slug: string): slug is FunnelSlug {
  return (FUNNEL_FLOW as readonly string[]).includes(slug);
}

export function stepForSlug(slug: string): QuizStep | null {
  return QUIZ_STEPS.find((s) => s.slug === slug) ?? null;
}

/**
 * Next slug in the flow, or null when the flow is complete (caller routes to /start). Unknown
 * slugs return null so a hand-typed URL can't wedge the machine.
 */
export function nextSlug(current: string): FunnelSlug | null {
  const i = (FUNNEL_FLOW as readonly string[]).indexOf(current);
  if (i < 0 || i >= FUNNEL_FLOW.length - 1) return null;
  return FUNNEL_FLOW[i + 1];
}

// ── Answer encoding (URL-only state) ─────────────────────────────────────────────────────────
// Encoded as dot-joined option indices, one per answered question: "0.2.1". Bounded so a crafted
// URL can't blow up rendering.
const MAX_OPTIONS = 8;
const AnswersSchema = z
  .array(z.number().int().min(0).max(MAX_OPTIONS - 1))
  .max(QUIZ_STEPS.length);

export function parseAnswers(raw: string | null | undefined): number[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  const parts = raw.split(".").map((p) => Number.parseInt(p, 10));
  const result = AnswersSchema.safeParse(parts);
  return result.success ? result.data : [];
}

export function encodeAnswers(answers: number[]): string {
  const result = AnswersSchema.safeParse(answers);
  return result.success ? result.data.join(".") : "";
}

/** Set the answer for a 0-based question index, returning a new array (URL is immutable state). */
export function setAnswer(
  answers: number[],
  stepIndex: number,
  optionIndex: number,
): number[] {
  const next = [...answers];
  next[stepIndex] = optionIndex;
  // Fill any gap left by a skipped index with 0 so the array stays dense and encodable.
  for (let i = 0; i < next.length; i += 1) {
    if (typeof next[i] !== "number") next[i] = 0;
  }
  return next;
}

export function answerForStep(
  answers: number[],
  stepIndex: number,
): number | null {
  const v = answers[stepIndex];
  return typeof v === "number" ? v : null;
}

// ── Tier matching (the whole point of Step 5) ────────────────────────────────────────────────

/**
 * Match the funnel tier from the answers. Step 5 is the license question and wins when present;
 * otherwise Step 4 (team size) is a reasonable proxy. Defaults to the popular middle ('pro') so
 * the offer page always has a tier to highlight.
 */
export function tierFromAnswers(answers: number[]): FunnelTier {
  const step5 = answerForStep(answers, 4);
  if (step5 !== null) {
    const opt = QUIZ_STEPS[4].options[step5];
    if (opt?.tier) return opt.tier;
  }
  const step4 = answerForStep(answers, 3);
  if (step4 !== null) {
    if (step4 === 0) return "starter";
    if (step4 === 1) return "pro";
    return "studio_plus"; // team of 5–10 or agency
  }
  return "pro";
}

/**
 * The Persona the offer page names in "built for [persona]". Derived from Step 1 (the hat that's
 * killing them). Defaults to the Sales Assistant — the most common owner bottleneck.
 */
export function personaForAnswers(answers: number[]): string {
  const step1 = answerForStep(answers, 0);
  switch (step1) {
    case 0:
      return "an Admin Assistant";
    case 1:
      return "a Sales Assistant";
    case 2:
      return "a Content Creator";
    case 3:
      return "a Chief of Staff";
    default:
      return "a Sales Assistant";
  }
}

// ── Micro-reassurance copy (Linkhiv pattern) ─────────────────────────────────────────────────
// Each affirmation ties the prior answer to a specific Pocket Agent part. r1 reads Step 1, r2
// reads Step 3.

export interface Reassurance {
  eyebrow: string;
  headline: string;
  body: string;
}

const R1_BY_STEP1: Reassurance[] = [
  {
    eyebrow: "Your Admin Assistant has this",
    headline: "The same emails, drafted before you ask.",
    body: "Pocket Agent reads your voice from your Business Brain and drafts the replies you write every week. You read, edit one line, approve. The blank box never sees your business again.",
  },
  {
    eyebrow: "Your Sales Assistant has this",
    headline: "No quote goes quiet again.",
    body: "Follow-Up Sweeps watches the threads that stalled — a quote with no reply, a lead that ghosted — and stages the next touch in your voice for one tap in Mission Control.",
  },
  {
    eyebrow: "Your Content Creator has this",
    headline: "Pages and posts, in your voice.",
    body: "The Landing Page Builder turns a brief into a live page on your own Vercel, voice-checked against your Business Brain. The content gets made instead of getting meant-to.",
  },
  {
    eyebrow: "One workspace, not ten tabs",
    headline: "Stop hunting across ten tools.",
    body: "Your Business Brain holds your customers, prices, processes, and decisions in one place your agents read from. One workspace your work lives in — not ten tabs you dig through.",
  },
];

const R2_BY_STEP3: Reassurance[] = [
  {
    eyebrow: "This week",
    headline: "First real output the day you sign in.",
    body: "The AI Office Launch Kit walks you from empty workspace to working agents. Your first drafts, your first follow-up sweep, your first brief — staged for your approval, not someday.",
  },
  {
    eyebrow: "This month",
    headline: "A workflow that actually sticks.",
    body: "Clone a Persona, point it at the work, watch it in Mission Control. By the end of the month it's not a tool you opened — it's a workspace your business runs on.",
  },
  {
    eyebrow: "This quarter",
    headline: "Built to run when you're not the bottleneck.",
    body: "Personas, approval queues, and the Idea Engine turn one owner doing everything into a workspace where agents do the prep and you approve what matters. Built for scale, on your own stack.",
  },
];

export function reassuranceContent(
  slug: "r1" | "r2",
  answers: number[],
): Reassurance {
  if (slug === "r1") {
    const i = answerForStep(answers, 0);
    return R1_BY_STEP1[i ?? -1] ?? R1_BY_STEP1[1];
  }
  const i = answerForStep(answers, 2);
  return R2_BY_STEP3[i ?? -1] ?? R2_BY_STEP3[0];
}

// ── Offer-page tier cards (single source for the 3-tier anchored pricing) ─────────────────────

export interface TierCard {
  tier: FunnelTier;
  name: string;
  /** Real monthly price (the configured Stripe price). */
  monthlyUsd: number;
  /** Crossed-out anchor shown above the real price. */
  anchorUsd: number;
  blurb: string;
  badge?: string;
  bullets: string[];
}

export const TIER_CARDS: TierCard[] = [
  {
    tier: "starter",
    name: "Personal Brain",
    monthlyUsd: 37,
    anchorUsd: 67,
    blurb: "Best for a personal AI workflow.",
    bullets: [
      "Single Business Brain + capture",
      "1 Persona",
      "5 prebuilt Skills",
      "Mission Control + budgets",
      "AI Office Launch Kit — free",
    ],
  },
  {
    tier: "pro",
    name: "Business Agent",
    monthlyUsd: 97,
    anchorUsd: 197,
    blurb: "Best value for owner-led businesses.",
    badge: "Popular",
    bullets: [
      "Everything in Personal Brain",
      "Clone-and-customize Personas",
      "Connected tools — Gmail, Calendar, Slack, QuickBooks",
      "Follow-Up Sweeps, Ingesters, Landing Page Builder",
      "20 prebuilt Skills",
    ],
  },
  {
    tier: "studio_plus",
    name: "AI Agent Workspace",
    monthlyUsd: 497,
    anchorUsd: 997,
    blurb: "Power operators, multi-business, and agencies.",
    badge: "Best value",
    bullets: [
      "Everything in Business Agent",
      "Idea Engine — ship a working MVP from one idea",
      "Lead Scout vertical packs (7 verticals)",
      "Decision Roundtable + advanced Mission Control",
      "All 30 prebuilt Skills",
    ],
  },
];

export function tierCardFor(tier: FunnelTier): TierCard {
  return TIER_CARDS.find((c) => c.tier === tier) ?? TIER_CARDS[1];
}

// Annual prepay = 2 months free (pay for 10 months). Display-only anchor reinforcement; the
// monthly price is what checkout charges.
export const ANNUAL_MONTHS_CHARGED = 10;

export function annualUsd(monthlyUsd: number): number {
  return monthlyUsd * ANNUAL_MONTHS_CHARGED;
}
