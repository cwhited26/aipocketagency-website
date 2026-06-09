// discover.ts — finds dormant contacts for a Follow-Up Sweeps source (PA-FUS-1).
//
// Three backends, one contract: each takes the owner + the source and returns the contacts that have
// gone quiet past the source's dormancy threshold. The sweep module persists what comes back and
// drafts the next touch. No backend ever invents a contact or a date — everything is sourced from
// Gmail, the brain repo, or the Lead Scout leads table, so the drafter can cite it honestly.
//
//   • gmail         — sent mail you fired N–2N days ago and haven't more-recently followed up on.
//   • brain_customer — customer files in the brain, dated by their most recent touch on file.
//   • lead_scout     — leads the Lead Scout found whose last touch is older than the threshold.
//
// Direct REST throughout (repo rule). Gmail reuses the shipped token resolver + search helpers; the
// To-header read is a direct messages.get since the shared getMessageMeta only carries From.

import { resolveGmailAccess } from "@/lib/connectors/gmail/read";
import { searchMessages } from "@/lib/gmail";
import { listDirMarkdownFiles, fetchFileContent } from "@/lib/pa-brain";
import type { DiscoveredContact, FollowupSweepSource } from "./types";

/** The slice of the owner's account the brain-customer backend reads. */
export type BrainAccess = { brain_repo: string | null; github_token: string | null };

export type DiscoverResult =
  | { ok: true; contacts: DiscoveredContact[] }
  | { ok: false; reason: string };

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const DAY_MS = 24 * 60 * 60 * 1000;
// Bound the Gmail hydration: each sent ref costs one messages.get, and the cron has a finite budget.
const GMAIL_MAX_REFS = 40;

function cutoffIso(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * DAY_MS).toISOString();
}

/** Parse a `Display Name <email@host>` (or bare `email@host`) header into name + email. */
export function parseAddress(value: string): { email: string; name: string | null } | null {
  const emailMatch = value.match(EMAIL_RE);
  if (!emailMatch) return null;
  const email = emailMatch[0].toLowerCase();
  // Strip the <email> and any surrounding quotes to recover the display name, if present.
  const name = value
    .replace(/<[^>]*>/, "")
    .replace(/["']/g, "")
    .trim();
  return { email, name: name && !name.includes("@") ? name : null };
}

// ─── Gmail ─────────────────────────────────────────────────────────────────────

const GMAIL_HEADER_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

type SentMeta = { to: string; date: string | null };

/** Direct messages.get for the To + Date headers (the shared getMessageMeta only carries From). */
async function fetchSentMeta(token: string, messageId: string): Promise<SentMeta | null> {
  const url = new URL(`${GMAIL_HEADER_URL}/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "To");
  url.searchParams.append("metadataHeaders", "Date");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    internalDate?: string;
    payload?: { headers?: { name: string; value: string }[] };
  };
  const headers = data.payload?.headers ?? [];
  const to = headers.find((h) => h.name.toLowerCase() === "to")?.value ?? "";
  const date =
    data.internalDate && Number.isFinite(Number(data.internalDate)) && Number(data.internalDate) > 0
      ? new Date(Number(data.internalDate)).toISOString()
      : null;
  return { to, date };
}

/**
 * Sent mail to recipients last emailed between N and 2N days ago. We window both ends: `older_than:Nd`
 * excludes anyone touched recently enough to not be dormant, and `newer_than:2Nd` keeps the list
 * recent enough to be worth a nudge. Group by recipient, keep the latest sent date as last_touched_at.
 */
async function discoverGmail(source: FollowupSweepSource, ownerId: string): Promise<DiscoverResult> {
  const access = await resolveGmailAccess(ownerId);
  if (!access.ok) return { ok: false, reason: access.error };

  const n = source.dormancy_days;
  const query = `in:sent older_than:${n}d newer_than:${2 * n}d`;
  const refs = await searchMessages(access.token, query, GMAIL_MAX_REFS);
  if (!refs.ok) return { ok: false, reason: refs.error };

  const byEmail = new Map<string, DiscoveredContact>();
  for (const ref of refs.data) {
    const meta = await fetchSentMeta(access.token, ref.id);
    if (!meta) continue;
    // A To header can list several recipients; the first is the primary follow-up target.
    const firstRecipient = meta.to.split(",")[0] ?? "";
    const parsed = parseAddress(firstRecipient);
    if (!parsed) continue;

    const existing = byEmail.get(parsed.email);
    const newer =
      !existing ||
      (meta.date && (!existing.lastTouchedAt || meta.date > existing.lastTouchedAt));
    if (newer) {
      byEmail.set(parsed.email, {
        contactEmail: parsed.email,
        contactName: parsed.name ?? existing?.contactName ?? null,
        lastTouchedAt: meta.date ?? existing?.lastTouchedAt ?? null,
        note: `Last emailed ${meta.date ? meta.date.slice(0, 10) : "a while ago"} — no reply since.`,
      });
    }
  }
  return { ok: true, contacts: [...byEmail.values()] };
}

// ─── Brain customers ─────────────────────────────────────────────────────────

const FRONTMATTER_DATE_KEYS = ["last_contact", "last_contacted", "last_touched", "last_touch"];
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

/** The most recent touch a customer file records: a frontmatter date key, else the latest date in it. */
export function extractLastTouched(content: string): string | null {
  for (const key of FRONTMATTER_DATE_KEYS) {
    const m = content.match(new RegExp(`^\\s*${key}\\s*:\\s*(\\d{4}-\\d{2}-\\d{2})`, "im"));
    if (m) return new Date(`${m[1]}T00:00:00Z`).toISOString();
  }
  let latest: string | null = null;
  for (const m of content.matchAll(ISO_DATE_RE)) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    if (!latest || iso > latest) latest = iso;
  }
  return latest ? new Date(`${latest}T00:00:00Z`).toISOString() : null;
}

export function extractName(content: string, fileName: string): string | null {
  const fm = content.match(/^\s*name\s*:\s*(.+)$/im);
  if (fm) return fm[1].trim();
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  // Fall back to a humanized filename ("maria-delgado.md" → "Maria Delgado").
  const base = fileName.replace(/\.md$/i, "").replace(/[-_]+/g, " ").trim();
  return base
    ? base.replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
}

/**
 * Customer files in the brain whose most recent touch is older than the dormancy threshold (or which
 * carry no email — skipped, since we can't draft to them). A file with no date at all is treated as
 * dormant: a customer the brain hasn't logged a touch for is exactly who a sweep should surface.
 */
async function discoverBrainCustomers(
  source: FollowupSweepSource,
  paUser: BrainAccess,
): Promise<DiscoverResult> {
  if (!paUser.brain_repo) return { ok: false, reason: "No brain connected." };
  const dir = source.source_config.brainDir?.trim() || "customers";
  const files = await listDirMarkdownFiles(paUser.brain_repo, paUser.github_token, dir);
  if (files.length === 0) {
    return { ok: false, reason: `No customer files found in the brain's "${dir}" folder.` };
  }

  const cutoff = cutoffIso(source.dormancy_days);
  const contacts: DiscoveredContact[] = [];
  for (const file of files) {
    const content = await fetchFileContent(paUser.brain_repo, file.path, paUser.github_token);
    if (!content) continue;
    const emailMatch = content.match(EMAIL_RE);
    if (!emailMatch) continue; // can't follow up by email without an address
    const lastTouched = extractLastTouched(content);
    // Dormant when undated, or dated older than the cutoff.
    if (lastTouched && lastTouched > cutoff) continue;
    contacts.push({
      contactEmail: emailMatch[0].toLowerCase(),
      contactName: extractName(content, file.name),
      lastTouchedAt: lastTouched,
      note: lastTouched
        ? `Brain shows last touch ${lastTouched.slice(0, 10)} (${file.path}).`
        : `Brain has a file but no recent touch logged (${file.path}).`,
    });
  }
  return { ok: true, contacts };
}

// ─── Lead Scout leads ──────────────────────────────────────────────────────────

type LeadRow = {
  name: string;
  contact: string;
  summary: string;
  profile: Record<string, unknown>;
  classification: string;
  status: string;
  outreach_drafted_at: string | null;
  created_at: string;
};

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

/** Best email for a lead: the contact column, then any email in the profile jsonb. */
function leadEmail(lead: LeadRow): string | null {
  const fromContact = lead.contact?.match(EMAIL_RE);
  if (fromContact) return fromContact[0].toLowerCase();
  for (const v of Object.values(lead.profile ?? {})) {
    if (typeof v === "string") {
      const m = v.match(EMAIL_RE);
      if (m) return m[0].toLowerCase();
    }
  }
  return null;
}

/**
 * Lead Scout leads with an email whose last touch (the outreach draft, else when they were found) is
 * older than the dormancy threshold. These are the leads worth a fresh reactivation — they were a fit
 * once and went quiet.
 */
async function discoverLeadScout(
  source: FollowupSweepSource,
  ownerId: string,
): Promise<DiscoverResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, reason: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/pa_lead_scout_leads?owner_id=eq.${encodeURIComponent(
      ownerId,
    )}&status=eq.extracted&order=created_at.desc&limit=500`,
    { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404) return { ok: false, reason: "Lead Scout isn't set up yet." };
    return { ok: false, reason: body.slice(0, 200) };
  }

  const leads = (await res.json()) as LeadRow[];
  const cutoff = cutoffIso(source.dormancy_days);
  const byEmail = new Map<string, DiscoveredContact>();
  for (const lead of leads) {
    const email = leadEmail(lead);
    if (!email) continue;
    const lastTouched = lead.outreach_drafted_at ?? lead.created_at;
    if (lastTouched > cutoff) continue; // touched recently enough — not dormant
    // Keep the most-recent record per email (leads dedupe across runs).
    const existing = byEmail.get(email);
    if (existing && existing.lastTouchedAt && existing.lastTouchedAt >= lastTouched) continue;
    byEmail.set(email, {
      contactEmail: email,
      contactName: lead.name || null,
      lastTouchedAt: lastTouched,
      note: `Lead Scout lead (${lead.classification}) — ${lead.summary || "found earlier"}, last touch ${lastTouched.slice(0, 10)}.`,
    });
  }
  return { ok: true, contacts: [...byEmail.values()] };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────

/** Find the dormant contacts for one source, dispatching to the backend its source_type names. */
export async function discoverDormantContacts(
  source: FollowupSweepSource,
  ownerId: string,
  paUser: BrainAccess,
): Promise<DiscoverResult> {
  switch (source.source_type) {
    case "gmail":
      return discoverGmail(source, ownerId);
    case "brain_customer":
      return discoverBrainCustomers(source, paUser);
    case "lead_scout":
      return discoverLeadScout(source, ownerId);
    default:
      return { ok: false, reason: `Unknown source type: ${source.source_type}` };
  }
}
