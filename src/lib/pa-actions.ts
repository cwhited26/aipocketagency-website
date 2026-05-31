// pa-actions.ts — data layer for pocket_agent_pending_actions
// All writes use the service-role key. RLS allows users to SELECT their own rows.
// No SDK — plain fetch against the Supabase REST API (same pattern as pa-supabase.ts).

import { z } from "zod";

// ─── Payload schemas ───────────────────────────────────────────────────────────

export const updateBrainMemoryPayloadSchema = z.object({
  repo: z.string().min(1).max(300),
  path: z.string().regex(/^memory\/[^/]+\.md$/),
  mode: z.enum(["append", "replace"]),
  content: z.string().min(1).max(100_000),
});

export type UpdateBrainMemoryPayload = z.infer<typeof updateBrainMemoryPayloadSchema>;

// ─── Row type ─────────────────────────────────────────────────────────────────

export type PendingActionStatus =
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "rejected"
  | "failed";

export type PendingActionType = "update_brain_memory" | "routine_output";

export type PendingAction = {
  id: string;
  user_id: string;
  action_type: PendingActionType;
  status: PendingActionStatus;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  decided_at: string | null;
  executed_at: string | null;
};

// ─── Env ──────────────────────────────────────────────────────────────────────

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pocket_agent_pending_actions";

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPendingAction(params: {
  userId: string;
  actionType: PendingActionType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}): Promise<PaResult<PendingAction>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: params.userId,
      action_type: params.actionType,
      title: params.title,
      summary: params.summary,
      payload: params.payload,
    }),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as PendingAction[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

// ─── Fetch by ID (ownership must be verified by the calling route) ─────────────

export async function fetchActionById(id: string): Promise<PaResult<PendingAction | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`,
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as PendingAction[];
  return { ok: true, data: rows[0] ?? null };
}

// ─── List for user ────────────────────────────────────────────────────────────

export async function listActionsForUser(userId: string): Promise<PaResult<PendingAction[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`,
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as PendingAction[];
  return { ok: true, data: rows };
}

// ─── Update status (service-role only) ───────────────────────────────────────

export async function updateActionStatus(
  id: string,
  patch: Partial<{
    status: PendingActionStatus;
    result: Record<string, unknown>;
    error: string;
    decided_at: string;
    executed_at: string;
  }>,
): Promise<PaResult<PendingAction>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as PendingAction[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after update." };
  return { ok: true, data: rows[0] };
}
