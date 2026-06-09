// db.ts — service-role REST data-access for the Decision Roundtable tables (migration 058). Mirrors
// lib/pa-conversations: direct PostgREST with the service key, no SDK. RLS exposes only the owner's own
// SELECT; every write here runs under the service role from a server route. Functions return a typed
// PaResult and never silently swallow a hard failure.

import type {
  DecisionType,
  Roundtable,
  RoundtableRole,
  RoundtableStatus,
  RoundtableTurn,
  StakesLevel,
} from "./types";

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
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string, prefer?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

const enc = encodeURIComponent;
const RT = "pa_decision_roundtables";
const TURNS = "pa_decision_roundtable_turns";

// ── Roundtable header ───────────────────────────────────────────────────────────────────────

export type CreateRoundtableInput = {
  ownerId: string;
  conversationId: string | null;
  question: string;
  decisionType: DecisionType;
  stakesLevel: StakesLevel;
  modelBackings: string[];
  totalRounds: number;
};

export async function createRoundtable(input: CreateRoundtableInput): Promise<PaResult<Roundtable>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${RT}`, {
    method: "POST",
    headers: authHeaders(env.key, "return=representation"),
    body: JSON.stringify({
      owner_id: input.ownerId,
      conversation_id: input.conversationId,
      question: input.question,
      status: "running",
      decision_type: input.decisionType,
      stakes_level: input.stakesLevel,
      model_backings: input.modelBackings,
      total_rounds: input.totalRounds,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Roundtable[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: rows[0] };
}

export async function getRoundtable(id: string, ownerId: string): Promise<PaResult<Roundtable | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${RT}?id=eq.${enc(id)}&owner_id=eq.${enc(ownerId)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Roundtable[];
  return { ok: true, data: rows[0] ?? null };
}

export async function listRoundtables(ownerId: string, limit = 50): Promise<PaResult<Roundtable[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${RT}?owner_id=eq.${enc(ownerId)}&order=started_at.desc&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as Roundtable[] };
}

export type RoundtablePatch = {
  status?: RoundtableStatus;
  verdict?: string | null;
  verdictBrainPath?: string | null;
  rejectionReason?: string | null;
  completedAt?: string | null;
  savedAt?: string | null;
  modelBackings?: string[];
};

export async function updateRoundtable(
  id: string,
  ownerId: string,
  patch: RoundtablePatch,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.verdict !== undefined) body.verdict = patch.verdict;
  if (patch.verdictBrainPath !== undefined) body.verdict_brain_path = patch.verdictBrainPath;
  if (patch.rejectionReason !== undefined) body.rejection_reason = patch.rejectionReason;
  if (patch.completedAt !== undefined) body.completed_at = patch.completedAt;
  if (patch.savedAt !== undefined) body.saved_at = patch.savedAt;
  if (patch.modelBackings !== undefined) body.model_backings = patch.modelBackings;

  const res = await fetch(
    `${env.url}/rest/v1/${RT}?id=eq.${enc(id)}&owner_id=eq.${enc(ownerId)}`,
    { method: "PATCH", headers: authHeaders(env.key, "return=minimal"), body: JSON.stringify(body), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/**
 * Best-effort optimistic lock for the /advance step: atomically stamps run_lock_at only if it's currently
 * null. Returns true when THIS caller won the claim. A second concurrent /advance gets false and backs off
 * — so the debate's expensive LLM rounds never double-fire from a double-mount or rapid re-poll.
 */
export async function claimAdvanceLock(id: string, ownerId: string): Promise<PaResult<boolean>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${RT}?id=eq.${enc(id)}&owner_id=eq.${enc(ownerId)}&run_lock_at=is.null&status=eq.running`,
    {
      method: "PATCH",
      headers: authHeaders(env.key, "return=representation"),
      body: JSON.stringify({ run_lock_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Roundtable[];
  return { ok: true, data: rows.length === 1 };
}

export async function releaseAdvanceLock(id: string, ownerId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${RT}?id=eq.${enc(id)}&owner_id=eq.${enc(ownerId)}`,
    {
      method: "PATCH",
      headers: authHeaders(env.key, "return=minimal"),
      body: JSON.stringify({ run_lock_at: null }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Count of roundtables the owner has STARTED this UTC month (excludes cancelled) — the monthly cap. */
export async function countRoundtablesThisMonth(ownerId: string): Promise<PaResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const res = await fetch(
    `${env.url}/rest/v1/${RT}?owner_id=eq.${enc(ownerId)}&started_at=gte.${enc(monthStart)}&status=neq.cancelled&select=id`,
    { headers: { ...authHeaders(env.key, "count=exact"), Range: "0-0" }, cache: "no-store" },
  );
  if (!res.ok && res.status !== 206) return { ok: false, status: res.status, error: await res.text() };
  // PostgREST returns the total in the Content-Range header (e.g. "0-0/12") when Prefer: count=exact.
  const range = res.headers.get("content-range") ?? "";
  const total = Number.parseInt(range.split("/")[1] ?? "", 10);
  return { ok: true, data: Number.isFinite(total) ? total : 0 };
}

// ── Turns ──────────────────────────────────────────────────────────────────────────────────

export type InsertTurnInput = {
  roundtableId: string;
  ownerId: string;
  role: RoundtableRole;
  modelBacking: string;
  roundIndex: number;
  turnIndex: number;
  content: string;
};

export async function insertTurns(inputs: InsertTurnInput[]): Promise<PaResult<RoundtableTurn[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  if (inputs.length === 0) return { ok: true, data: [] };
  const res = await fetch(`${env.url}/rest/v1/${TURNS}`, {
    method: "POST",
    headers: authHeaders(env.key, "return=representation"),
    body: JSON.stringify(
      inputs.map((i) => ({
        roundtable_id: i.roundtableId,
        owner_id: i.ownerId,
        role: i.role,
        model_backing: i.modelBacking,
        round_index: i.roundIndex,
        turn_index: i.turnIndex,
        content: i.content,
      })),
    ),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as RoundtableTurn[] };
}

export async function insertTurn(input: InsertTurnInput): Promise<PaResult<RoundtableTurn>> {
  const result = await insertTurns([input]);
  if (!result.ok) return result;
  if (!result.data[0]) return { ok: false, status: 500, error: "No turn row returned" };
  return { ok: true, data: result.data[0] };
}

export async function getTurns(roundtableId: string, ownerId: string): Promise<PaResult<RoundtableTurn[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TURNS}?roundtable_id=eq.${enc(roundtableId)}&owner_id=eq.${enc(ownerId)}&order=turn_index.asc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as RoundtableTurn[] };
}
