// build-smart-context.ts — smart conversation-context blending for Persona turns (PA-CTX-3).
//
// The naive pattern loads "the last N messages" and drops everything older. For a long-running team
// conversation that throws away the bulk of the thread. This helper blends four signals into one
// composed context block:
//
//   (a) recent N messages, verbatim                      → returned as `recentMessages` (model turns)
//   (b) rolling summaries of older message ranges        → `## Earlier in this conversation`
//   (c) top-K lexically relevant older messages          → `## Relevant earlier messages`
//   (d) the owner's daily-log activity (last 3 days)     → the pre-built `## Recent activity` block
//
// (b)+(c)+(d) are prose and injected into the system prompt (`promptBlock`); (a) flows as structured
// model turns. `block` is the single composed string of all four, for any caller that wants one blob.
//
// The summarizer and relevance scorer are injected so the core is pure + deterministically testable.
// Defaults: extractive summary (no LLM) and Jaccard keyword overlap (reused from the hybrid retriever),
// so the helper is safe and fast on the hot path even when no LLM summarizer is supplied.

import { jaccardOverlap, tokenize } from "@/lib/rag/hybrid";

export type ContextMessage = { role: "user" | "assistant"; content: string };

/** Async summarizer for one older range. Throwing falls back to the extractive default (logged). */
export type Summarize = (messages: ContextMessage[]) => Promise<string>;

/** Relevance of one older message to the current query, higher = more relevant. */
export type ScoreRelevance = (query: string, message: ContextMessage) => number;

export type BuildSmartContextOptions = {
  /** How many of the most-recent messages to keep verbatim as model turns. Default 8. */
  recentN?: number;
  /** How many older messages, by relevance, to surface verbatim. Default 3. */
  topK?: number;
  /** Size of each older range that gets one rolling summary. Default 8. */
  rangeSize?: number;
  /** Max number of older ranges to summarize (oldest beyond this is omitted + logged). Default 4. */
  maxRanges?: number;
  /** Pre-formatted `## Recent activity` block from getDailyLogsForContext (or "" / omitted). */
  dailyLogsBlock?: string;
  summarize?: Summarize;
  scoreRelevance?: ScoreRelevance;
};

export type SmartContextStats = {
  totalMessages: number;
  recentCount: number;
  olderCount: number;
  summaryRanges: number;
  relevantCount: number;
  omittedOlder: number;
  dailyLogsIncluded: boolean;
  blockChars: number;
};

export type SmartContext = {
  /** Single composed block: recent + summaries + relevant + daily logs (one blob). */
  block: string;
  /** Summaries + relevant + daily logs only — inject into the system prompt (recent flow as turns). */
  promptBlock: string;
  /** The recent N messages, verbatim, for the model `messages` array. */
  recentMessages: ContextMessage[];
  stats: SmartContextStats;
};

function logLine(level: "info" | "warn", msg: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), scope: "smart-context", level, msg, ...(fields ?? {}) });
  if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Default extractive summary: a compact role-tagged digest of a range, truncated. No LLM. */
function extractiveSummary(messages: ContextMessage[]): string {
  const parts = messages.map((m) => {
    const who = m.role === "user" ? "Them" : "Agent";
    const text = m.content.replace(/\s+/g, " ").trim();
    return `${who}: ${text.length > 160 ? `${text.slice(0, 160)}…` : text}`;
  });
  return parts.join(" / ");
}

/** Default relevance: Jaccard overlap between the query and the message, reusing the hybrid tokenizer. */
function defaultScoreRelevance(query: string, message: ContextMessage): number {
  return jaccardOverlap(tokenize(query), tokenize(message.content));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Blend recent messages, rolling summaries of older ranges, top-K relevant older messages, and the
 * owner's daily activity into one composed context. Pure aside from the injected summarizer; returns
 * deterministic output for the default (extractive) summarizer + (Jaccard) scorer.
 */
export async function buildSmartContext(
  messages: ContextMessage[],
  query: string,
  options: BuildSmartContextOptions = {},
): Promise<SmartContext> {
  const recentN = Math.max(0, options.recentN ?? 8);
  const topK = Math.max(0, options.topK ?? 3);
  const rangeSize = Math.max(1, options.rangeSize ?? 8);
  const maxRanges = Math.max(0, options.maxRanges ?? 4);
  const dailyLogsBlock = (options.dailyLogsBlock ?? "").trim();
  const summarize = options.summarize;
  const scoreRelevance = options.scoreRelevance ?? defaultScoreRelevance;

  const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const recentMessages = recentN === 0 ? [] : turns.slice(-recentN);
  const older = recentN === 0 ? turns.slice() : turns.slice(0, Math.max(0, turns.length - recentN));

  // (b) Rolling summaries. Keep the most-recent `maxRanges` ranges; older-than-that is omitted (logged,
  // never silently). Each kept range is summarized via the injected summarizer, falling back to the
  // extractive digest if it throws — a summarizer outage degrades, it doesn't break the turn.
  const allRanges = chunk(older, rangeSize);
  const keptRanges = maxRanges === 0 ? [] : allRanges.slice(Math.max(0, allRanges.length - maxRanges));
  const omittedRanges = allRanges.length - keptRanges.length;
  const omittedOlder = omittedRanges > 0 ? allRanges.slice(0, omittedRanges).reduce((n, r) => n + r.length, 0) : 0;
  if (omittedOlder > 0) {
    logLine("info", "older ranges beyond maxRanges omitted from summary", { omittedOlder, maxRanges, rangeSize });
  }

  const summaries: string[] = [];
  for (const range of keptRanges) {
    if (summarize) {
      try {
        const s = (await summarize(range)).trim();
        summaries.push(s || extractiveSummary(range));
        continue;
      } catch (e) {
        logLine("warn", "summarizer failed; using extractive fallback", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    summaries.push(extractiveSummary(range));
  }

  // (c) Top-K lexically relevant older messages, verbatim, in original order.
  const relevant = older
    .map((m, i) => ({ m, i, score: scoreRelevance(query, m) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, topK)
    .sort((a, b) => a.i - b.i)
    .map((r) => r.m);

  // Compose the sections.
  const summarySection = summaries.length
    ? `## Earlier in this conversation\nRolling summary of older messages (oldest first):\n${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "";
  const relevantSection = relevant.length
    ? `## Relevant earlier messages\nThe most on-topic earlier turns for the current question:\n${relevant
        .map((m) => `- ${m.role === "user" ? "Them" : "Agent"}: ${m.content.replace(/\s+/g, " ").trim()}`)
        .join("\n")}`
    : "";
  const recentSection = recentMessages.length
    ? `## Recent messages\n${recentMessages
        .map((m) => `- ${m.role === "user" ? "Them" : "Agent"}: ${m.content.replace(/\s+/g, " ").trim()}`)
        .join("\n")}`
    : "";

  const promptBlock = [summarySection, relevantSection, dailyLogsBlock].filter(Boolean).join("\n\n");
  const block = [recentSection, summarySection, relevantSection, dailyLogsBlock].filter(Boolean).join("\n\n");

  const stats: SmartContextStats = {
    totalMessages: turns.length,
    recentCount: recentMessages.length,
    olderCount: older.length,
    summaryRanges: summaries.length,
    relevantCount: relevant.length,
    omittedOlder,
    dailyLogsIncluded: dailyLogsBlock.length > 0,
    blockChars: block.length,
  };

  return { block, promptBlock, recentMessages, stats };
}
