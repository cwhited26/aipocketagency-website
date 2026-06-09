// pa-inbox-items.ts — data layer for the Inbox staging table (pa_inbox_items).
//
// The Inbox holds two kinds of staged work:
//   • draft    — an artifact PA produced autonomously (an email from the Email
//                Drafter, generated content) that waits for the user's approval
//                before it executes (e.g. the email actually sends).
//   • decision — a yes/no question PA needs answered. Approve = yes, reject = no.
//
// All writes use the service-role key. RLS lets users SELECT only their own rows
// (defense-in-depth); every function here scopes by user_id and the calling
// routes enforce an ownership gate before mutating. No SDK — plain fetch against
// the Supabase REST API, matching pa-actions.ts / pa-connections.ts.
//
// Distinct from pa-inbox.ts, which parses the iOS *Capture* Inbox (PA-INBOX
// blocks in the brain repo). This file is the action-staging Inbox.

// 'action_approval' (PA v5 Wave B) stages a connector write-action for one-tap approval; its
// action-specific detail lives in pa_action_approvals (migration 021). 'build_action_approval'
// is the same primitive for the BUILD connectors (GitHub Build et al., Build Tools SPEC §9.3) —
// it resolves through the same approval route + ActionApprovalCard, themed as a build action.
// 'sub_agent_activity' is a dismissible progress card. 'routine_output' (migration 023) is an
// informational routine result (Daily Brief / Weekly Digest / Follow-up Sweep) — read, never approve.
// 'gate_findings' (migration 060, PA-GATE-9) is a held Project plan its specialist gates flagged or
// blocked; it resolves via Revise / Reject / Approve-anyway through /api/orchestrator/gates/[id].
export type InboxKind =
  | "draft"
  | "decision"
  | "email_triage"
  | "persona_lead"
  | "action_approval"
  | "sub_agent_activity"
  | "routine_output"
  | "lead_scout_batch"
  | "build_action_approval"
  | "cost_budget_gate"
  | "skill_evolution_proposal"
  | "gate_findings";
export type InboxStatus = "pending" | "approved" | "rejected" | "expired";

export type InboxItem = {
  id: string;
  user_id: string;
  kind: InboxKind;
  title: string;
  body_md: string | null;
  source: string | null;
  payload: Record<string, unknown>;
  status: InboxStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  expires_at: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

// List can succeed in a "degraded" way: the migration hasn't been applied yet,
// so the table is missing. We surface that explicitly (never a silent empty) so
// the route can tell the difference between "no items" and "not provisioned".
type PaListResult =
  | { ok: true; data: InboxItem[]; degraded?: "table_missing" }
  | { ok: false; status: number; error: string };

const TABLE = "pa_inbox_items";

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

// PostgREST returns 404 + code PGRST205 (or a "does not exist" message) when the
// relation is absent. Recognise that one case so an unapplied migration degrades
// to "legacy items only" instead of a hard 500.
function isMissingTable(status: number, body: string): boolean {
  if (status !== 404) return false;
  return body.includes("PGRST205") || body.includes(TABLE) || body.includes("does not exist");
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createInboxItem(params: {
  userId: string;
  kind: InboxKind;
  title: string;
  bodyMd: string | null;
  source: string;
  payload: Record<string, unknown>;
  expiresAt?: string | null;
}): Promise<PaResult<InboxItem>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: params.userId,
      kind: params.kind,
      title: params.title,
      body_md: params.bodyMd,
      source: params.source,
      payload: params.payload,
      expires_at: params.expiresAt ?? null,
    }),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as InboxItem[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

// ─── List (newest first) ──────────────────────────────────────────────────────

export async function listInboxItems(userId: string): Promise<PaListResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=100`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );

  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body)) return { ok: true, data: [], degraded: "table_missing" };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as InboxItem[];
  return { ok: true, data: rows };
}

// ─── Gmail triage dedup (existing thread ids for a user) ──────────────────────

// The cron dedups in application code before inserting: pull the thread ids of
// every email_triage item already staged for this user (source='gmail') and skip
// any thread we have seen. The partial unique index (migration 014) is the
// defense-in-depth backstop against a concurrent double-run.
export async function fetchGmailTriageThreadIds(
  userId: string,
): Promise<PaResult<Set<string>>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&kind=eq.email_triage&source=eq.gmail&select=payload`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body)) return { ok: true, data: new Set() };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as { payload?: Record<string, unknown> }[];
  const ids = new Set<string>();
  for (const row of rows) {
    const threadId = row.payload?.threadId;
    if (typeof threadId === "string") ids.add(threadId);
  }
  return { ok: true, data: ids };
}

// Mark a triage item handled (archived / handed off). Looked up by the gmail
// thread id since the action route only knows the thread, not our row id.
export async function resolveGmailTriageByThread(
  userId: string,
  threadId: string,
  resolvedBy: string,
): Promise<PaResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&kind=eq.email_triage` +
      `&status=eq.pending` +
      `&payload->>threadId=eq.${encodeURIComponent(threadId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "approved",
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: Array.isArray(rows) ? rows.length : 0 };
}

// ─── Count pending (badge) ────────────────────────────────────────────────────

export async function countPendingInbox(userId: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&select=id`,
    {
      headers: { ...authHeaders(env.key), Prefer: "count=exact" },
      cache: "no-store",
    },
  );
  if (!res.ok) return 0; // missing table / transient → no badge, never throws

  // Prefer the exact count from the Content-Range header; fall back to row length.
  const range = res.headers.get("content-range");
  if (range) {
    const total = range.split("/")[1];
    const parsed = Number(total);
    if (Number.isFinite(parsed)) return parsed;
  }
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

// ─── Fetch by id (ownership verified by the caller) ───────────────────────────

export async function fetchInboxItemById(id: string): Promise<PaResult<InboxItem | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as InboxItem[];
  return { ok: true, data: rows[0] ?? null };
}

// ─── Resolve (approve / reject / expire) — service-role only ──────────────────

export async function resolveInboxItem(
  id: string,
  status: Exclude<InboxStatus, "pending">,
  resolvedBy: string,
): Promise<PaResult<InboxItem>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    }),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as InboxItem[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after update." };
  return { ok: true, data: rows[0] };
}
