// rules.ts — auto-routing rules (PA-CAPTURE-1): the deterministic, owner-authored layer that files a
// shared item straight into a dedicated brain path instead of leaving it in memory/inbox.md.
//
// Two halves:
//   • Pure evaluation — matchesPattern / evaluateRules sort the owner's enabled rules by priority
//     (high→low, created_at as the tiebreak) and return the first rule that matches. No I/O, fully
//     unit-tested.
//   • I/O — CRUD against pa_capture_routing_rules (service-role REST, no SDK) + applyRouting, the
//     hook the share endpoint calls after the YouTube/Podcast ingest and before the inbox fallback.
//
// Brand hard rules: direct REST, no `any`, no silent catch — a write that fails returns a typed error.

import type { InboxEntry } from "@/lib/pa-inbox";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import { fetchFileContent } from "@/lib/pa-brain";
import {
  type CaptureMatchPattern,
  type CaptureRoutingRule,
  renderCaptureBlock,
  renderCaptureNote,
  resolveTargetPath,
} from "./types";

const TABLE = "pa_capture_routing_rules";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ── Pure evaluation ────────────────────────────────────────────────────────────────

/** The haystack a rule's conditions test against: title + content + source URL, lowercased. */
function haystackFor(entry: InboxEntry): string {
  return [entry.title ?? "", entry.content ?? "", entry.sourceUrl ?? ""].join("\n").toLowerCase();
}

/**
 * True when an entry satisfies a rule's pattern. A rule matches only when EVERY condition it
 * specifies matches (AND); an empty pattern (no conditions) never matches — the default inbox
 * fallback owns the unmatched case, so a no-condition catch-all is disallowed by design. An
 * unparseable regex is treated as a non-match and reported by the caller, never thrown.
 */
export function matchesPattern(entry: InboxEntry, pattern: CaptureMatchPattern): boolean {
  const conditions: boolean[] = [];
  const haystack = haystackFor(entry);

  if (pattern.keywords && pattern.keywords.length > 0) {
    const kws = pattern.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
    conditions.push(kws.length > 0 && kws.some((k) => haystack.includes(k)));
  }

  if (pattern.regex && pattern.regex.trim()) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(pattern.regex, "i");
    } catch {
      re = null; // an invalid stored regex degrades to a non-match (the route validates on write)
    }
    conditions.push(re !== null && re.test(haystack));
  }

  if (pattern.sourceUrlContains && pattern.sourceUrlContains.trim()) {
    const needle = pattern.sourceUrlContains.trim().toLowerCase();
    conditions.push((entry.sourceUrl ?? "").toLowerCase().includes(needle));
  }

  if (pattern.contentType) {
    conditions.push(entry.kind === pattern.contentType);
  }

  // No conditions specified → never matches; otherwise all specified conditions must hold.
  return conditions.length > 0 && conditions.every(Boolean);
}

/**
 * Pick the first matching rule. Rules are evaluated highest-priority first, with the older rule
 * winning a priority tie (stable, predictable for the owner). Disabled rules are skipped. Returns
 * null when nothing matches.
 */
export function evaluateRules(
  entry: InboxEntry,
  rules: CaptureRoutingRule[],
): CaptureRoutingRule | null {
  const ordered = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));
  for (const rule of ordered) {
    if (matchesPattern(entry, rule.match_pattern)) return rule;
  }
  return null;
}

// ── CRUD (service-role REST) ────────────────────────────────────────────────────────

export async function listRoutingRules(ownerId: string): Promise<PaResult<CaptureRoutingRule[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&order=priority.desc,created_at.asc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    // An unapplied migration degrades to "no rules" rather than a hard 500 (mirrors pa-inbox-items).
    if (res.status === 404 && (body.includes("PGRST205") || body.includes(TABLE))) {
      return { ok: true, data: [] };
    }
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as CaptureRoutingRule[] };
}

export async function createRoutingRule(params: {
  ownerId: string;
  matchPattern: CaptureMatchPattern;
  targetPath: string;
  enabled: boolean;
  priority: number;
}): Promise<PaResult<CaptureRoutingRule>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      match_pattern: params.matchPattern,
      target_path: params.targetPath,
      enabled: params.enabled,
      priority: params.priority,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CaptureRoutingRule[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

export async function updateRoutingRule(params: {
  id: string;
  ownerId: string;
  patch: Partial<{
    matchPattern: CaptureMatchPattern;
    targetPath: string;
    enabled: boolean;
    priority: number;
  }>;
}): Promise<PaResult<CaptureRoutingRule>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.patch.matchPattern !== undefined) body.match_pattern = params.patch.matchPattern;
  if (params.patch.targetPath !== undefined) body.target_path = params.patch.targetPath;
  if (params.patch.enabled !== undefined) body.enabled = params.patch.enabled;
  if (params.patch.priority !== undefined) body.priority = params.patch.priority;

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(params.id)}&owner_id=eq.${encodeURIComponent(params.ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as CaptureRoutingRule[];
  if (!rows[0]) return { ok: false, status: 404, error: "Rule not found." };
  return { ok: true, data: rows[0] };
}

export async function deleteRoutingRule(id: string, ownerId: string): Promise<PaResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "DELETE", headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

// ── Writing the routed note ─────────────────────────────────────────────────────────

export type CaptureWriteCtx = { repo: string; token: string };

/**
 * Write a captured entry into a target brain path. A target ending in `.md` is read and the entry
 * appended; any other target is a directory and the entry becomes a new dated note. Both carry the
 * capture signature so the cleanup pass can verify the write before pruning the inbox. Returns the
 * concrete path written, or a typed error.
 */
export async function writeCaptureNote(params: {
  ctx: CaptureWriteCtx;
  entry: InboxEntry;
  targetPath: string;
  routedBy: "rule" | "triage";
  bucket?: import("./types").TriageBucket;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { ctx, entry, targetPath, routedBy, bucket } = params;
  const resolved = resolveTargetPath(targetPath, entry);

  let content: string;
  if (resolved.isFile) {
    const existing = await fetchFileContent(ctx.repo, resolved.path, ctx.token);
    const block = renderCaptureBlock(entry, { routedBy, bucket });
    content = existing ? `${existing.trimEnd()}\n${block}\n` : `${block.trimStart()}\n`;
  } else {
    content = renderCaptureNote(entry, { routedBy, bucket });
  }

  const commit = await commitBrainTextFile({
    repo: ctx.repo,
    token: ctx.token,
    path: resolved.path,
    content,
    commitMessage: `Pocket Agent — Capture Inbox routed: ${entry.title || entry.kind}`,
  });
  if (!commit.ok) return { ok: false, error: commit.error };
  return { ok: true, path: resolved.path };
}

/**
 * The share-endpoint hook: evaluate the owner's rules against a freshly-captured entry and, on a
 * match, file it into the dedicated brain path. Returns the matched rule + written path (the caller
 * then prunes the inbox entry via the cleanup pass), or routed:false when no rule matched. A write
 * failure surfaces as routed:false + error — the entry stays safely in memory/inbox.md.
 */
export async function applyRouting(params: {
  ctx: CaptureWriteCtx;
  entry: InboxEntry;
  rules: CaptureRoutingRule[];
}): Promise<
  | { routed: true; ruleId: string; path: string }
  | { routed: false; error?: string }
> {
  const rule = evaluateRules(params.entry, params.rules);
  if (!rule) return { routed: false };

  const write = await writeCaptureNote({
    ctx: params.ctx,
    entry: params.entry,
    targetPath: rule.target_path,
    routedBy: "rule",
  });
  if (!write.ok) return { routed: false, error: write.error };
  return { routed: true, ruleId: rule.id, path: write.path };
}
