// lib/emails/queue.ts — the service-role data layer for the email system (migration 076). Direct
// PostgREST, no SDK — matches lib/rituals/db.ts and lib/followup-sweeps/db.ts. Every write goes through
// the service-role key (the four tables are deny-all RLS). Typed results, never a silent empty.

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const QUEUE = "pa_email_queue";
const PREFS = "pa_email_preferences";
const ACTIVATION = "pa_email_activation_state";
const CANCEL = "pa_cancellation_attempts";

export type EmailQueueStatus = "pending" | "sent" | "failed" | "cancelled";

export type EmailQueueRow = {
  id: string;
  owner_id: string | null;
  email: string;
  template_slug: string;
  template_props: Record<string, unknown>;
  sequence_slug: string | null;
  send_at: string;
  sent_at: string | null;
  status: EmailQueueStatus;
  error_text: string | null;
  cancel_reason: string | null;
  attempts: number;
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

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function isMissingTable(status: number, body: string, table: string): boolean {
  return status === 404 || body.includes(table);
}

// ── Enqueue ──────────────────────────────────────────────────────────────────────────────────────

export type EnqueueInput = {
  ownerId: string | null;
  email: string;
  templateSlug: string;
  templateProps?: Record<string, unknown>;
  sequenceSlug?: string | null;
  /** ISO timestamp of when to send. */
  sendAt: string;
};

function toRow(input: EnqueueInput): Record<string, unknown> {
  return {
    owner_id: input.ownerId,
    email: input.email,
    template_slug: input.templateSlug,
    template_props: input.templateProps ?? {},
    sequence_slug: input.sequenceSlug ?? null,
    send_at: input.sendAt,
    status: "pending",
  };
}

/** Insert one queued email. Returns the new row id. */
export async function enqueueEmail(input: EnqueueInput): Promise<PaResult<string>> {
  return enqueueMany([input]).then((r) =>
    r.ok ? { ok: true, data: r.data[0] ?? "" } : r,
  );
}

/** Bulk-insert queued emails (one sequence at a time). Returns the new row ids in order. */
export async function enqueueMany(inputs: EnqueueInput[]): Promise<PaResult<string[]>> {
  if (inputs.length === 0) return { ok: true, data: [] };
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${QUEUE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(inputs.map(toRow)),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  return { ok: true, data: rows.map((r) => r.id) };
}

// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

/** Pending emails whose send_at is due, oldest first, up to `limit`. Empty (not an error) pre-migration. */
export async function listDueEmails(limit: number, nowIso?: string): Promise<PaResult<EmailQueueRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = nowIso ?? new Date().toISOString();
  const url =
    `${env.url}/rest/v1/${QUEUE}?status=eq.pending&send_at=lte.${encodeURIComponent(now)}` +
    `&order=send_at.asc&limit=${limit}`;
  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, QUEUE)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as EmailQueueRow[] };
}

async function patchRow(id: string, patch: Record<string, unknown>): Promise<PaResult<null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${QUEUE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: null };
}

export async function markEmailSent(id: string, sentAtIso?: string): Promise<PaResult<null>> {
  return patchRow(id, { status: "sent", sent_at: sentAtIso ?? new Date().toISOString(), error_text: null });
}

/** Cancel a single queued row (e.g. the recipient unsubscribed before this one sent). */
export async function markEmailCancelled(id: string, reason: string): Promise<PaResult<null>> {
  return patchRow(id, { status: "cancelled", cancel_reason: reason });
}

/**
 * Record a send failure. Bumps attempts; if attempts has reached the cap the row goes to 'failed',
 * otherwise it stays 'pending' with send_at pushed out by the backoff so the next sweep retries it.
 */
export async function markEmailFailure(args: {
  id: string;
  attempts: number;
  errorText: string;
  maxAttempts: number;
  nextSendAtIso: string;
}): Promise<PaResult<null>> {
  const exhausted = args.attempts >= args.maxAttempts;
  return patchRow(args.id, {
    attempts: args.attempts,
    error_text: args.errorText,
    ...(exhausted ? { status: "failed" } : { send_at: args.nextSendAtIso }),
  });
}

// ── Cancellation ─────────────────────────────────────────────────────────────────────────────────

/** Cancel all pending rows for an owner within the given sequences. Returns the count cancelled. */
export async function cancelPendingForOwnerSequences(
  ownerId: string,
  sequences: readonly string[],
  reason: string,
): Promise<PaResult<number>> {
  if (sequences.length === 0) return { ok: true, data: 0 };
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const inList = sequences.map((s) => `"${s}"`).join(",");
  const url =
    `${env.url}/rest/v1/${QUEUE}?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&status=eq.pending&sequence_slug=in.(${encodeURIComponent(inList)})`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled", cancel_reason: reason }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, QUEUE)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length };
}

/**
 * Cancel pending rows for an owner whose template_slug is in `slugs` (cancel-on-advance: e.g. cancel a
 * pending bb-no-persona reminder the moment the owner creates a Persona). No-op when slugs is empty.
 */
export async function cancelPendingTriggersForOwner(
  ownerId: string,
  slugs: readonly string[],
  reason: string,
): Promise<PaResult<number>> {
  if (slugs.length === 0) return { ok: true, data: 0 };
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const inList = slugs.map((s) => `"${s}"`).join(",");
  const url =
    `${env.url}/rest/v1/${QUEUE}?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&status=eq.pending&template_slug=in.(${encodeURIComponent(inList)})`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled", cancel_reason: reason }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, QUEUE)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length };
}

/** Cancel all pending marketing rows for an email (unsubscribe path). Transactional rows are left. */
export async function cancelPendingForEmail(email: string, reason: string): Promise<PaResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const url =
    `${env.url}/rest/v1/${QUEUE}?email=eq.${encodeURIComponent(email)}&status=eq.pending`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled", cancel_reason: reason }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, QUEUE)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length };
}

/**
 * How many rows for (owner, templateSlug) were created since `sinceIso`, in any status. Backs the
 * usage-cap "not already sent in the last 30 days" guard (counts queued OR sent — both mean we touched
 * them recently). When ownerId is null, falls back to email.
 */
export async function countRecentByTemplate(args: {
  ownerId: string | null;
  email: string;
  templateSlug: string;
  sinceIso: string;
}): Promise<PaResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const scope = args.ownerId
    ? `owner_id=eq.${encodeURIComponent(args.ownerId)}`
    : `email=eq.${encodeURIComponent(args.email)}`;
  const url =
    `${env.url}/rest/v1/${QUEUE}?${scope}&template_slug=eq.${encodeURIComponent(args.templateSlug)}` +
    `&created_at=gte.${encodeURIComponent(args.sinceIso)}&select=id`;
  const res = await fetch(url, {
    headers: { ...authHeaders(env.key), Prefer: "count=exact" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, QUEUE)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length };
}

// ── Email preferences (unsubscribe) ────────────────────────────────────────────────────────────

export async function isUnsubscribed(email: string): Promise<PaResult<boolean>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const lower = email.trim().toLowerCase();
  const url =
    `${env.url}/rest/v1/${PREFS}?email=eq.${encodeURIComponent(lower)}` +
    `&unsubscribed_at=not.is.null&select=id&limit=1`;
  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, PREFS)) return { ok: true, data: false };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length > 0 };
}

/** Mark an email unsubscribed from marketing mail. Idempotent (upsert on the unique email index). */
export async function setUnsubscribed(email: string): Promise<PaResult<null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const lower = email.trim().toLowerCase();
  const res = await fetch(`${env.url}/rest/v1/${PREFS}?on_conflict=email`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ email: lower, unsubscribed_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: null };
}

// ── Activation state ─────────────────────────────────────────────────────────────────────────────

export async function hasTriggerFired(ownerId: string, triggerSlug: string): Promise<PaResult<boolean>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const url =
    `${env.url}/rest/v1/${ACTIVATION}?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&trigger_slug=eq.${encodeURIComponent(triggerSlug)}&select=id&limit=1`;
  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body, ACTIVATION)) return { ok: true, data: false };
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length > 0 };
}

/**
 * Record that a trigger fired. Idempotent on (owner, trigger) — a conflict means another sweep already
 * fired it. Returns true when THIS call inserted the row (so the caller should send), false when it was
 * already present (so the caller should skip).
 */
export async function recordTriggerFired(ownerId: string, triggerSlug: string): Promise<PaResult<boolean>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${ACTIVATION}?on_conflict=owner_id,trigger_slug`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({ owner_id: ownerId, trigger_slug: triggerSlug }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: rows.length > 0 };
}

// ── Owner lookup ─────────────────────────────────────────────────────────────────────────────────

/** Resolve an owner's email + name from their most recent subscription row. null if none / pre-migration. */
export async function resolveOwnerContact(
  ownerId: string,
): Promise<{ email: string; firstName: string | null } | null> {
  const env = paEnv();
  if ("error" in env) return null;
  const url =
    `${env.url}/rest/v1/pocket_agent_subscriptions?user_id=eq.${encodeURIComponent(ownerId)}` +
    `&select=email,name&order=created_at.desc&limit=1`;
  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ email: string; name: string | null }>;
  if (rows.length === 0) return null;
  return { email: rows[0].email, firstName: rows[0].name };
}

// ── Cancellation attempts ────────────────────────────────────────────────────────────────────────

export async function insertCancellationAttempt(args: {
  ownerId: string | null;
  reason: string;
  saved: boolean;
}): Promise<PaResult<null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${CANCEL}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ owner_id: args.ownerId, reason: args.reason, saved: args.saved }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: null };
}
