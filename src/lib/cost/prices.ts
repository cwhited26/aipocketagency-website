// TODO [2026-06-09] verify Bright Data + Modal rates against current invoice; Anthropic + OpenAI rates verified 2026-06-09.
//
// prices.ts — the hand-maintained price table for every metered backend PA fires (Cost Observability
// SPEC §9, the "Pricing reference" the Cost tab shows). getCostMicroCents() turns a provider's usage
// payload into a realized cost in MICRO-CENTS (1/10,000 of a cent; 1 USD = 1,000,000 micro-cents — the
// Stripe `unit_amount_decimal` / AWS-billing / ad-tech standard, PA-COST-9). Micro-cents is the ledger's
// storage unit precisely so sub-cent events — a single Haiku fit-classify (~0.08 cent), one Bright Data
// request (0.3 cent) — stay lossless instead of rounding to zero. Anthropic + OpenAI bill per token /
// per audio-hour and the rates are published; Bright Data + Modal are flat-rate estimates the table
// approximates until a real invoice is reconciled (the TODO above). Pure + dependency-free so the cost
// math is unit-tested in isolation (lib/cost/__tests__/prices.test.ts).
//
// All rates live here as named constants so a provider price change is a one-line edit, and the Cost
// tab can render the table verbatim. Unknown model/backend degrades to 0 micro-cents + a structured
// warn — never a throw, never a silent guess that double-counts or invents cost. The return value may
// be fractional (e.g. one Haiku input token = 0.8 micro-cents); the ledger writer rounds to the integer
// BIGINT column on write — rounding to whole micro-cents, never to whole cents, is the whole point.

export type CostBackend = "anthropic" | "openai" | "bright_data" | "modal" | "twilio" | "resend" | "vercel";

/** The usage payload a metered call returns. Every field optional — each backend reads what it needs. */
export type CostUsage = {
  /** LLM input (prompt) tokens. */
  tokensInput?: number;
  /** LLM output (completion) tokens. */
  tokensOutput?: number;
  /** Flat-rate request count (Bright Data Web Unlocker / SERP). */
  requests?: number;
  /** Whisper audio length in minutes. */
  audioMinutes?: number;
  /** Modal active CPU time in seconds. */
  cpuSeconds?: number;
  /** Modal provisioned memory in GB-hours. */
  memoryGbHours?: number;
};

// ── Anthropic (USD per 1M tokens, published 2026-06-09) ───────────────────────────────────
const ANTHROPIC_RATES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  // claude-sonnet-4-6 — the house model (chat, drafters, extract, vision OCR).
  "claude-sonnet-4-6": { input: 3, output: 15 },
  // claude-haiku-4-5 — the cheap classifier (lead fit, YouTube/podcast bucket).
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

/** Resolve a concrete model id (e.g. "claude-haiku-4-5-20251001") to its rate by longest-prefix match. */
function anthropicRate(model: string | null): { input: number; output: number } | null {
  if (!model) return null;
  if (ANTHROPIC_RATES_USD_PER_MTOK[model]) return ANTHROPIC_RATES_USD_PER_MTOK[model];
  for (const key of Object.keys(ANTHROPIC_RATES_USD_PER_MTOK)) {
    if (model.startsWith(key)) return ANTHROPIC_RATES_USD_PER_MTOK[key];
  }
  return null;
}

// ── OpenAI Whisper (USD per audio-hour, published 2026-06-09) ──────────────────────────────
const WHISPER_USD_PER_HOUR = 6;

// ── Bright Data Web Unlocker / SERP (flat estimate — see TODO) ─────────────────────────────
// ~$3 per 1,000 requests.
const BRIGHT_DATA_USD_PER_REQUEST = 3 / 1000;

// ── Modal Sandbox (approximate — see TODO) ─────────────────────────────────────────────────
// ~$0.000131 active-CPU-second + ~$0.00000667 per GB-second of provisioned memory (~$0.024/GB-hr).
const MODAL_USD_PER_CPU_SECOND = 0.000131;
const MODAL_USD_PER_GB_HOUR = 0.024;

// ── Vercel Functions active CPU (approximate — the URL extraction worker's browser runs) ────
// Pro plan Active CPU ~$0.128 per CPU-hour. The worker bills wall-clock run seconds as a proxy
// for active CPU — a deliberate over-estimate (idle waits count), reconciled like Modal's rates.
const VERCEL_USD_PER_CPU_SECOND = 0.128 / 3600;

// 1 USD = 100 cents = 1,000,000 micro-cents (1 cent = 10,000 micro-cents).
const USD_TO_MICRO_CENTS = 1_000_000;

/**
 * Realized cost of one metered call, in micro-cents (1/10,000 of a cent). May be fractional (e.g. one
 * Haiku input token = 0.8 micro-cents) — the ledger writer rounds to the integer BIGINT column on write,
 * rounding to whole micro-cents (never to whole cents), so sub-cent calls stay lossless and summable as
 * pure integer math. Unknown backend / unknown Anthropic model degrades to 0 micro-cents + a structured
 * warn so a missing rate surfaces in logs instead of silently mispricing the ledger.
 */
export function getCostMicroCents(backend: CostBackend, model: string | null, usage: CostUsage): number {
  switch (backend) {
    case "anthropic": {
      const rate = anthropicRate(model);
      if (!rate) {
        console.warn("[cost/prices] unknown Anthropic model — pricing as 0 micro-cents", { model });
        return 0;
      }
      const inputUsd = ((usage.tokensInput ?? 0) / 1_000_000) * rate.input;
      const outputUsd = ((usage.tokensOutput ?? 0) / 1_000_000) * rate.output;
      return (inputUsd + outputUsd) * USD_TO_MICRO_CENTS;
    }
    case "openai": {
      // whisper-1 is the only OpenAI backend PA fires today.
      const minutes = usage.audioMinutes ?? 0;
      return (minutes / 60) * WHISPER_USD_PER_HOUR * USD_TO_MICRO_CENTS;
    }
    case "bright_data": {
      const requests = usage.requests ?? 0;
      return requests * BRIGHT_DATA_USD_PER_REQUEST * USD_TO_MICRO_CENTS;
    }
    case "modal": {
      const cpuUsd = (usage.cpuSeconds ?? 0) * MODAL_USD_PER_CPU_SECOND;
      const memUsd = (usage.memoryGbHours ?? 0) * MODAL_USD_PER_GB_HOUR;
      return (cpuUsd + memUsd) * USD_TO_MICRO_CENTS;
    }
    case "vercel": {
      return (usage.cpuSeconds ?? 0) * VERCEL_USD_PER_CPU_SECOND * USD_TO_MICRO_CENTS;
    }
    default: {
      console.warn("[cost/prices] no price model for backend — pricing as 0 micro-cents", { backend });
      return 0;
    }
  }
}

// ── Pricing reference (Cost tab "How we price this", SPEC adversarial §9) ────────────────────
//
// The Cost tab renders the exact rates the ledger prices against so an owner can spot-check a spend
// figure against the provider's own invoice (the cost-mismatch defense). It's built FROM the constants
// above — there's no second copy of the numbers to drift. A rate change above is the only edit; the
// panel re-derives. Each entry is one backend, the unit it bills in, and its per-unit line items.

export type PriceLine = { name: string; rate: string };

export type PriceReferenceEntry = {
  backend: CostBackend;
  label: string;
  unit: string;
  lines: PriceLine[];
  /** Set when the rate is a hand-kept estimate the table reconciles against a real invoice, not a published per-call number. */
  estimated: boolean;
};

const USD = (n: number): string => `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;

/**
 * The price table as the Cost tab shows it — derived from the rate constants above, never a second
 * copy. Twilio + Resend are intentionally absent: PA doesn't price SMS/email through this table (they
 * pass through at the provider's own per-message rate), and getCostMicroCents degrades them to 0 rather
 * than invent a number, so showing them here would imply a rate that isn't real.
 */
export function priceReference(): PriceReferenceEntry[] {
  return [
    {
      backend: "anthropic",
      label: "Anthropic (Claude)",
      unit: "per 1M tokens",
      estimated: false,
      lines: Object.entries(ANTHROPIC_RATES_USD_PER_MTOK).map(([name, rate]) => ({
        name,
        rate: `${USD(rate.input)} in · ${USD(rate.output)} out`,
      })),
    },
    {
      backend: "openai",
      label: "OpenAI (Whisper)",
      unit: "per audio-hour",
      estimated: false,
      lines: [{ name: "whisper-1", rate: USD(WHISPER_USD_PER_HOUR) }],
    },
    {
      backend: "bright_data",
      label: "Bright Data",
      unit: "per 1,000 requests",
      estimated: true,
      lines: [{ name: "Web Unlocker / SERP", rate: USD(BRIGHT_DATA_USD_PER_REQUEST * 1000) }],
    },
    {
      backend: "modal",
      label: "Modal (sandbox)",
      unit: "per unit",
      estimated: true,
      lines: [
        { name: "Active CPU", rate: `${USD(MODAL_USD_PER_CPU_SECOND)} / sec` },
        { name: "Provisioned memory", rate: `${USD(MODAL_USD_PER_GB_HOUR)} / GB-hr` },
      ],
    },
    {
      backend: "vercel",
      label: "Vercel (extraction worker)",
      unit: "per run-second",
      estimated: true,
      lines: [{ name: "Active CPU", rate: `${USD(VERCEL_USD_PER_CPU_SECOND)} / sec` }],
    },
  ];
}
