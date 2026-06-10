// types.ts — the Capture Inbox shared types + pure helpers (no I/O).
//
// The Capture Inbox is one App over the share-extension capture flow with three behaviors:
//   • Auto-routing rules (rules.ts) file a shared item straight into a dedicated brain path.
//   • A Monday triage sweep (triage.ts) classifies the still-unfiled entries and stages a proposal.
//   • A cleanup pass (cleanup.ts) prunes an entry from memory/inbox.md once it lives in a real note.
//
// This module holds the types both the routing and triage paths share, plus the pure helpers that
// resolve a target path, render a capture note, and build the cleanup signature — no network, no DB,
// so it is safe to import from server routes, the cron, and tests alike.

import type { InboxEntry } from "@/lib/pa-inbox";

// ── Routing rules ────────────────────────────────────────────────────────────────

/** The capture kinds a rule's content_type condition can match (mirrors pa-inbox InboxKind). */
export type CaptureContentType = "text" | "url" | "note" | "voice";

export const CAPTURE_CONTENT_TYPES: readonly CaptureContentType[] = [
  "text",
  "url",
  "note",
  "voice",
] as const;

/**
 * One rule's match conditions. A rule matches an entry only when EVERY condition it specifies
 * matches (AND across the present fields); an empty pattern matches nothing (the default fallback
 * to memory/inbox.md handles unmatched items, so a no-condition catch-all is a footgun we disallow).
 *   • keywords — at least one keyword appears (case-insensitive) in the entry's title/content/url.
 *   • regex — the pattern matches (case-insensitive) the entry's title/content/url.
 *   • sourceUrlContains — the entry's source URL contains this substring (case-insensitive).
 *   • contentType — the entry's kind equals this exact type.
 */
export type CaptureMatchPattern = {
  keywords?: string[];
  regex?: string;
  sourceUrlContains?: string;
  contentType?: CaptureContentType;
};

/** A persisted routing rule (pa_capture_routing_rules row shape). */
export type CaptureRoutingRule = {
  id: string;
  owner_id: string;
  match_pattern: CaptureMatchPattern;
  target_path: string;
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

// ── Triage buckets ───────────────────────────────────────────────────────────────

/**
 * The six triage buckets the Haiku classifier sorts an unfiled entry into. The first four mirror the
 * YouTube classifier's use-case buckets (competitor→competitive); 'personal' and 'unsure' are the
 * capture-specific additions — 'unsure' is the honest "I couldn't place this" bucket that keeps low-
 * confidence picks out of a confident brain area.
 */
export type TriageBucket =
  | "competitive"
  | "tactic"
  | "testimonial"
  | "industry"
  | "personal"
  | "unsure";

export const TRIAGE_BUCKETS: readonly TriageBucket[] = [
  "competitive",
  "tactic",
  "testimonial",
  "industry",
  "personal",
  "unsure",
] as const;

/** Where each bucket files in the brain. 'unsure' lands in a neutral notes folder for the owner to move. */
export const TRIAGE_BUCKET_DIRS: Record<TriageBucket, string> = {
  competitive: "brain/competitive",
  tactic: "brain/voice/influences",
  testimonial: "brain/testimonials",
  industry: "brain/industry",
  personal: "brain/personal",
  unsure: "brain/notes",
};

/** Plain-English label per bucket for the proposal card. */
export const TRIAGE_BUCKET_LABELS: Record<TriageBucket, string> = {
  competitive: "Competitor intel",
  tactic: "A tactic worth keeping",
  testimonial: "A customer quote",
  industry: "Industry update",
  personal: "Personal note",
  unsure: "Couldn't place it",
};

export function isTriageBucket(value: string): value is TriageBucket {
  return (TRIAGE_BUCKETS as readonly string[]).includes(value);
}

/** The inbox-card kind the triage sweep stages (migration 066 admits it to the kind CHECK). */
export const CAPTURE_TRIAGE_PROPOSAL_KIND = "capture_triage_proposal";

/** The payload stored on a capture_triage_proposal inbox item. */
export type CaptureTriagePayload = {
  entryId: string;
  bucket: TriageBucket;
  targetPath: string;
  contentPreview: string;
  title?: string;
  sourceUrl?: string;
};

// ── Pure helpers (shared by routing + triage; no I/O) ──────────────────────────────

export function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/**
 * The stable marker embedded in every routed/triaged note. The cleanup pass confirms this string is
 * present at the target path before it prunes the entry — so an entry is only ever removed from
 * memory/inbox.md once its content is verifiably written somewhere else in the brain.
 */
export function captureSignature(entryId: string): string {
  return `capture-source:${entryId}`;
}

export type ResolvedTarget = { path: string; isFile: boolean };

/**
 * Resolve a rule/bucket target_path into a concrete brain file path. A path ending in `.md` is a
 * file the entry is appended to; anything else is treated as a directory and the entry becomes a new
 * dated note `<dir>/<YYYY-MM-DD>-<slug>.md`.
 */
export function resolveTargetPath(targetPath: string, entry: InboxEntry): ResolvedTarget {
  const trimmed = targetPath.trim().replace(/^\/+|\/+$/g, "");
  if (trimmed.toLowerCase().endsWith(".md")) {
    return { path: trimmed, isFile: true };
  }
  const date = (entry.ts || new Date().toISOString()).slice(0, 10);
  const slug = slugify(entry.title || entry.content, "capture");
  return { path: `${trimmed}/${date}-${slug}.md`, isFile: false };
}

/** Frontmatter-quoted scalar (JSON.stringify keeps colons/quotes in titles from breaking the YAML). */
function yaml(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}`;
}

/**
 * Render a captured entry as a standalone brain note (used when the target resolves to a new file).
 * Carries the capture signature in the frontmatter so cleanup can verify it landed.
 */
export function renderCaptureNote(
  entry: InboxEntry,
  opts: { bucket?: TriageBucket; routedBy: "rule" | "triage" },
): string {
  const title = entry.title || (entry.kind === "url" ? "Captured link" : "Captured note");
  const front = [
    "---",
    yaml("title", title),
    yaml("captured_at", entry.ts),
    yaml("source", "capture-inbox"),
    yaml("routed_by", opts.routedBy),
    ...(opts.bucket ? [yaml("bucket", opts.bucket)] : []),
    ...(entry.sourceUrl ? [yaml("url", entry.sourceUrl)] : []),
    yaml("capture_source_id", entry.id),
    "metadata:",
    "  type: reference",
    "---",
  ].join("\n");

  const body: string[] = [`# ${title}`, ""];
  if (entry.sourceUrl) body.push(`**Source:** ${entry.sourceUrl}`, "");
  body.push(entry.content.trim() || "(no content)");
  // The signature lives in the body too, so a `.includes()` check passes regardless of how a future
  // editor reshuffles the frontmatter.
  body.push("", `<!-- ${captureSignature(entry.id)} -->`);

  return `${front}\n\n${body.join("\n")}\n`;
}

/**
 * Render a captured entry as an appendable block (used when the target resolves to an existing file).
 * Same signature marker so cleanup verification is uniform across file-append and new-note targets.
 */
export function renderCaptureBlock(
  entry: InboxEntry,
  opts: { bucket?: TriageBucket; routedBy: "rule" | "triage" },
): string {
  const title = entry.title || (entry.kind === "url" ? "Captured link" : "Captured note");
  const date = entry.ts.slice(0, 10);
  const lines: string[] = ["", `## ${title} (${date})`];
  if (entry.sourceUrl) lines.push(`**Source:** ${entry.sourceUrl}`);
  if (opts.bucket) lines.push(`_${TRIAGE_BUCKET_LABELS[opts.bucket]}_`);
  lines.push("", entry.content.trim() || "(no content)", "", `<!-- ${captureSignature(entry.id)} -->`);
  return lines.join("\n");
}
