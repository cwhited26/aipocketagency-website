// classify.ts — the YouTube use-case classifier + bucket-specific extraction (v1.0 discoverability).
//
// After the ingester pulls a transcript, we sort the video into one of four use-case buckets (plus a
// default) and lead the upload card with bucket-specific framing instead of a generic summary, so the
// owner immediately sees what PA *did with* the video — not just what it was about:
//
//   competitor   → "Logged what they claimed" + the actual claims (price, positioning, dates, diffs)
//   tactic       → "Pulled the techniques into your voice influences" + the named techniques bulleted
//   testimonial  → "Extracted the quotes for you" + 3-5 lift-and-paste quotes with timestamps
//   industry     → "Summarized + slotted into your daily roll-up" + a 4-bullet summary + key timestamp
//   default      → generic one-paragraph summary
//
// The bucket also decides where in the brain the note lands (competitive intel vs. voice influences
// vs. testimonials vs. the youtube roll-up). Two Claude calls: a CHEAP Haiku classify (title +
// channel + first 500 chars) and one Sonnet extraction tailored to the bucket. Direct REST, no SDK,
// typed results, no silent catch — a failure degrades to the generic summary.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001"; // cheap — this is just a 1-word bucket pick
const EXTRACT_MODEL = "claude-sonnet-4-6";

export type UseCaseBucket = "competitor" | "tactic" | "testimonial" | "industry" | "default";

export const USE_CASE_BUCKETS: readonly UseCaseBucket[] = [
  "competitor",
  "tactic",
  "testimonial",
  "industry",
  "default",
] as const;

/** Per-bucket card framing: the lead line the upload card shows + the brain area the note lands in. */
export const BUCKET_FRAMINGS: Record<
  UseCaseBucket,
  { headline: string; brainDir: string; detailLabel: string }
> = {
  competitor: {
    headline: "Logged what they claimed — added to your competitive intel.",
    brainDir: "brain/competitive",
    detailLabel: "What they claimed",
  },
  tactic: {
    headline: "Pulled the techniques into your voice influences.",
    brainDir: "brain/voice/influences",
    detailLabel: "Techniques",
  },
  testimonial: {
    headline: "Extracted the quotes for you.",
    brainDir: "brain/testimonials",
    detailLabel: "Lift-and-paste quotes",
  },
  industry: {
    headline: "Summarized + slotted into your daily roll-up.",
    brainDir: "brain/youtube",
    detailLabel: "The rundown",
  },
  default: {
    headline: "Summarized for you.",
    brainDir: "brain/youtube",
    detailLabel: "Summary",
  },
};

function isBucket(value: string): value is UseCaseBucket {
  return (USE_CASE_BUCKETS as readonly string[]).includes(value);
}

// ── Classify (cheap, Haiku) ────────────────────────────────────────────────────

const CLASSIFY_PROMPT = `You sort a YouTube video into ONE use-case bucket for a small-business owner's AI agent. Reply with EXACTLY one word, nothing else:

- competitor — a competitor, a product launch, or company news (the owner wants to know what a rival claimed)
- tactic — sales/marketing/how-to/business-tactic creator content (e.g. Russell Brunson, Alex Hormozi, Gary Vee — the owner wants the techniques)
- testimonial — a customer testimonial, case study, or review (the owner wants lift-and-paste quotes)
- industry — an industry update, news, or podcast in the owner's field (the owner wants a summary for their roll-up)
- default — none of the above

Answer with one word from: competitor, tactic, testimonial, industry, default.`;

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * Picks the use-case bucket via a cheap Haiku call on title + channel + the first 500 transcript
 * chars. Degrades to "default" on no-key / API error / unparseable output — never throws.
 */
export async function classifyBucket(params: {
  apiKey: string | null;
  title: string;
  channel: string;
  transcriptHead: string;
  /** When set, one anthropic (Haiku) cost event is logged for this classify call. */
  cost?: CostContext;
}): Promise<UseCaseBucket> {
  if (!params.apiKey) return "default";

  const input = `Title: ${params.title}\nChannel: ${params.channel}\nTranscript start: ${params.transcriptHead.slice(0, 500)}`;

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: `${CLASSIFY_PROMPT}\n\n${input}` }],
      }),
      cache: "no-store",
    });
  } catch {
    return "default"; // classifier is best-effort; a network blip means generic framing, not a crash
  }
  if (!res.ok) return "default";

  const data = (await res.json()) as AnthropicResponse;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", CLASSIFY_MODEL, {
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    });
  }
  const word = (data.content?.find((c) => c.type === "text")?.text ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return isBucket(word) ? word : "default";
}

// ── Bucket-specific extraction (Sonnet) ─────────────────────────────────────────

const EXTRACT_PROMPTS: Record<Exclude<UseCaseBucket, "default">, string> = {
  competitor: `This video is from a competitor / a product launch / company news. In ONE tight paragraph, extract the ACTUAL claims a business owner needs on file: prices, positioning, launch/availability dates, and named differentiators. Quote specifics. No preamble, no "this video" filler — just the claims.`,
  tactic: `This is business-tactic / sales / marketing / how-to creator content. List the NAMED techniques, frameworks, or plays the creator teaches — one per line, each starting with "- ", named and one-line-explained so the owner can apply it. No preamble. 3-8 bullets.`,
  testimonial: `This is a customer testimonial / case study / review. Pull 3-5 LIFT-AND-PASTE quotes a business could drop onto a landing page or into a proposal. One per line starting with "- ", each in double quotes, and append the timestamp in [mm:ss] when the transcript is timestamped. Only real, verbatim-as-possible lines — no paraphrase, no invention.`,
  industry: `This is an industry update / news / podcast. Give a 4-bullet rundown (one per line, starting with "- ") of what matters for someone in this field, then a final line "Key moment: [mm:ss] — <why>" pointing at the single most important moment (use the transcript timestamps when present).`,
};

/**
 * Produces the bucket-specific detail text rendered on the card and stored in the note. `transcript`
 * should be timestamped (`[mm:ss] line`) when caption segments are available so testimonial/industry
 * can cite moments. Falls back to the provided `genericSummary` on no-key / API error — never throws.
 */
export async function extractBucketDetail(params: {
  apiKey: string | null;
  bucket: UseCaseBucket;
  title: string;
  channel: string;
  transcript: string;
  genericSummary: string;
  /** When set, one anthropic (Sonnet) cost event is logged for this extraction call. */
  cost?: CostContext;
}): Promise<string> {
  if (params.bucket === "default" || !params.apiKey) return params.genericSummary;

  const prompt = EXTRACT_PROMPTS[params.bucket];
  const transcriptForModel = params.transcript.slice(0, 28_000);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nVideo: "${params.title}" by ${params.channel}\n\nTranscript:\n${transcriptForModel}`,
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    return params.genericSummary; // deliberate degrade to the generic summary, not a swallow
  }
  if (!res.ok) return params.genericSummary;

  const data = (await res.json()) as AnthropicResponse;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", EXTRACT_MODEL, {
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    });
  }
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  return text || params.genericSummary;
}
