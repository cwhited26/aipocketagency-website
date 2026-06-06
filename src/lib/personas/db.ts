// db.ts — data-access layer for the Personas tables (migration 015). Uses the PA
// Supabase project over PostgREST with the service-role key, mirroring lib/pa-supabase.
// All writes go through here (RLS exposes only owner SELECTs). Functions throw
// PersonaDbError on a hard failure (never a silent catch) and return null for
// not-found; routes wrap calls in try/catch and translate to HTTP responses.

import type {
  LeadSource,
  LeadStatus,
  PersonaConversationRow,
  PersonaLeadRow,
  PersonaMessageRow,
  PersonaMode,
  PersonaRow,
  PersonaSeatRow,
  PersonaShareTokenRow,
  PersonaSpecRow,
  PersonaStatus,
  PersonaUsageMonthlyRow,
  PersonaWidgetConfigRow,
  RateLimitScope,
  SeatRole,
  ToneKey,
  WidgetConfigUpdate,
} from "./types";

export class PersonaDbError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "PersonaDbError";
    this.status = status;
  }
}

function env(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new PersonaDbError("Supabase env vars not set", 500);
  }
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
  body?: unknown;
};

async function rest<T>(pathAndQuery: string, init: RestInit = {}): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PersonaDbError(
      `Supabase ${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

const enc = encodeURIComponent;

// ── personas ────────────────────────────────────────────────────────────────────────

export async function insertPersona(row: {
  business_id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  template_key: string;
  tone: ToneKey;
  status: PersonaStatus;
  spec_path: string;
  knowledge_zone_key: string;
}): Promise<PersonaRow> {
  const rows = await rest<PersonaRow[]>("personas", {
    method: "POST",
    prefer: "return=representation",
    body: { ...row, mode: "internal_team" },
  });
  if (!rows[0]) throw new PersonaDbError("Persona insert returned no row");
  return rows[0];
}

export async function fetchPersona(id: string): Promise<PersonaRow | null> {
  const rows = await rest<PersonaRow[]>(`personas?id=eq.${enc(id)}&limit=1`);
  return rows[0] ?? null;
}

export async function listPersonasForBusiness(businessId: string): Promise<PersonaRow[]> {
  return rest<PersonaRow[]>(
    `personas?business_id=eq.${enc(businessId)}&status=neq.archived&order=created_at.desc`,
  );
}

export async function listAllActivePersonas(): Promise<PersonaRow[]> {
  return rest<PersonaRow[]>("personas?status=eq.active&order=business_id.asc");
}

export async function countPersonasForBusiness(businessId: string): Promise<number> {
  const rows = await rest<{ id: string }[]>(
    `personas?business_id=eq.${enc(businessId)}&status=neq.archived&select=id`,
  );
  return rows.length;
}

export async function updatePersona(
  id: string,
  patch: Partial<{
    name: string;
    tone: ToneKey;
    status: PersonaStatus;
    mode: PersonaMode;
    current_spec_version: string;
    updated_at: string;
  }>,
): Promise<PersonaRow | null> {
  const rows = await rest<PersonaRow[]>(`personas?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { ...patch, updated_at: patch.updated_at ?? new Date().toISOString() },
  });
  return rows[0] ?? null;
}

// ── persona_specs ─────────────────────────────────────────────────────────────────────

export async function maxSpecVersion(personaId: string): Promise<number> {
  const rows = await rest<{ version: number }[]>(
    `persona_specs?persona_id=eq.${enc(personaId)}&select=version&order=version.desc&limit=1`,
  );
  return rows[0]?.version ?? 0;
}

export async function insertSpec(row: {
  persona_id: string;
  version: number;
  body_md: string;
  created_by: string | null;
}): Promise<PersonaSpecRow> {
  const rows = await rest<PersonaSpecRow[]>("persona_specs", {
    method: "POST",
    prefer: "return=representation",
    body: row,
  });
  if (!rows[0]) throw new PersonaDbError("Spec insert returned no row");
  return rows[0];
}

export async function fetchSpec(id: string): Promise<PersonaSpecRow | null> {
  const rows = await rest<PersonaSpecRow[]>(`persona_specs?id=eq.${enc(id)}&limit=1`);
  return rows[0] ?? null;
}

export async function listSpecs(personaId: string): Promise<PersonaSpecRow[]> {
  return rest<PersonaSpecRow[]>(
    `persona_specs?persona_id=eq.${enc(personaId)}&order=version.desc`,
  );
}

/** Resolves the persona's authoritative current spec (by current_spec_version, else latest). */
export async function fetchCurrentSpec(persona: PersonaRow): Promise<PersonaSpecRow | null> {
  if (persona.current_spec_version) {
    const byId = await fetchSpec(persona.current_spec_version);
    if (byId) return byId;
  }
  const rows = await rest<PersonaSpecRow[]>(
    `persona_specs?persona_id=eq.${enc(persona.id)}&order=version.desc&limit=1`,
  );
  return rows[0] ?? null;
}

// ── persona_seats ──────────────────────────────────────────────────────────────────────

export async function upsertSeat(row: {
  persona_id: string;
  invited_email: string;
  role: SeatRole;
}): Promise<PersonaSeatRow> {
  // Re-inviting a previously revoked email clears revoked_at via the upsert.
  const rows = await rest<PersonaSeatRow[]>(
    "persona_seats?on_conflict=persona_id,invited_email",
    {
      method: "POST",
      prefer: "return=representation,resolution=merge-duplicates",
      body: {
        ...row,
        invited_at: new Date().toISOString(),
        accepted_user_id: null,
        accepted_at: null,
        revoked_at: null,
      },
    },
  );
  if (!rows[0]) throw new PersonaDbError("Seat upsert returned no row");
  return rows[0];
}

export async function fetchSeat(id: string): Promise<PersonaSeatRow | null> {
  const rows = await rest<PersonaSeatRow[]>(`persona_seats?id=eq.${enc(id)}&limit=1`);
  return rows[0] ?? null;
}

export async function listSeats(personaId: string): Promise<PersonaSeatRow[]> {
  return rest<PersonaSeatRow[]>(
    `persona_seats?persona_id=eq.${enc(personaId)}&order=invited_at.desc`,
  );
}

export async function countLiveSeatsForPersona(personaId: string): Promise<number> {
  const rows = await rest<{ id: string }[]>(
    `persona_seats?persona_id=eq.${enc(personaId)}&revoked_at=is.null&select=id`,
  );
  return rows.length;
}

export async function updateSeat(
  id: string,
  patch: Partial<{ accepted_user_id: string; accepted_at: string; revoked_at: string }>,
): Promise<PersonaSeatRow | null> {
  const rows = await rest<PersonaSeatRow[]>(`persona_seats?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: patch,
  });
  return rows[0] ?? null;
}

// ── persona_share_tokens ────────────────────────────────────────────────────────────────

export async function insertShareToken(row: {
  token: string;
  persona_id: string;
  seat_id: string | null;
  expires_at: string | null;
  mode?: PersonaMode;
}): Promise<PersonaShareTokenRow> {
  const { mode = "internal_team", ...rest_ } = row;
  const rows = await rest<PersonaShareTokenRow[]>("persona_share_tokens", {
    method: "POST",
    prefer: "return=representation",
    body: { ...rest_, mode },
  });
  if (!rows[0]) throw new PersonaDbError("Share token insert returned no row");
  return rows[0];
}

/** The persona's current live (seat-less) public/widget token, if any. */
export async function fetchLivePublicToken(
  personaId: string,
  mode: PersonaMode,
): Promise<PersonaShareTokenRow | null> {
  const rows = await rest<PersonaShareTokenRow[]>(
    `persona_share_tokens?persona_id=eq.${enc(personaId)}&mode=eq.${enc(mode)}&seat_id=is.null&revoked_at=is.null&order=created_at.desc&limit=1`,
  );
  return rows[0] ?? null;
}

export async function fetchShareToken(token: string): Promise<PersonaShareTokenRow | null> {
  const rows = await rest<PersonaShareTokenRow[]>(
    `persona_share_tokens?token=eq.${enc(token)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function listSeatTokens(seatId: string): Promise<PersonaShareTokenRow[]> {
  return rest<PersonaShareTokenRow[]>(
    `persona_share_tokens?seat_id=eq.${enc(seatId)}&order=created_at.desc`,
  );
}

export async function revokeTokensForSeat(seatId: string): Promise<void> {
  await rest<undefined>(
    `persona_share_tokens?seat_id=eq.${enc(seatId)}&revoked_at=is.null`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { revoked_at: new Date().toISOString() },
    },
  );
}

export async function revokeAllPersonaTokens(personaId: string): Promise<void> {
  await rest<undefined>(
    `persona_share_tokens?persona_id=eq.${enc(personaId)}&revoked_at=is.null`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { revoked_at: new Date().toISOString() },
    },
  );
}

// ── persona_conversations ────────────────────────────────────────────────────────────────

export async function insertConversation(row: {
  persona_id: string;
  seat_id: string | null;
}): Promise<PersonaConversationRow> {
  const rows = await rest<PersonaConversationRow[]>("persona_conversations", {
    method: "POST",
    prefer: "return=representation",
    body: row,
  });
  if (!rows[0]) throw new PersonaDbError("Conversation insert returned no row");
  return rows[0];
}

export async function fetchConversation(
  id: string,
): Promise<PersonaConversationRow | null> {
  const rows = await rest<PersonaConversationRow[]>(
    `persona_conversations?id=eq.${enc(id)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function listConversationsForPersona(
  personaId: string,
  limit = 200,
): Promise<PersonaConversationRow[]> {
  return rest<PersonaConversationRow[]>(
    `persona_conversations?persona_id=eq.${enc(personaId)}&order=started_at.desc&limit=${limit}`,
  );
}

export async function listConversationsSince(
  personaId: string,
  sinceIso: string,
): Promise<PersonaConversationRow[]> {
  return rest<PersonaConversationRow[]>(
    `persona_conversations?persona_id=eq.${enc(personaId)}&started_at=gte.${enc(sinceIso)}&order=started_at.desc`,
  );
}

export async function bumpConversationStats(
  id: string,
  deltas: { messages: number; tokens: number },
  current: { message_count: number; token_cost_total: number },
): Promise<void> {
  await rest<undefined>(`persona_conversations?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      message_count: current.message_count + deltas.messages,
      token_cost_total: current.token_cost_total + deltas.tokens,
    },
  });
}

// ── persona_messages ──────────────────────────────────────────────────────────────────────

export async function insertMessage(row: {
  conversation_id: string;
  role: PersonaMessageRow["role"];
  content: string;
  tokens_used: number;
  blocked_by_containment?: boolean;
}): Promise<PersonaMessageRow> {
  const rows = await rest<PersonaMessageRow[]>("persona_messages", {
    method: "POST",
    prefer: "return=representation",
    body: { blocked_by_containment: false, ...row },
  });
  if (!rows[0]) throw new PersonaDbError("Message insert returned no row");
  return rows[0];
}

export async function listMessages(conversationId: string): Promise<PersonaMessageRow[]> {
  return rest<PersonaMessageRow[]>(
    `persona_messages?conversation_id=eq.${enc(conversationId)}&order=created_at.asc`,
  );
}

// ── persona_usage_monthly ─────────────────────────────────────────────────────────────────

export async function fetchUsageMonthly(
  personaId: string,
  month: string,
): Promise<PersonaUsageMonthlyRow | null> {
  const rows = await rest<PersonaUsageMonthlyRow[]>(
    `persona_usage_monthly?persona_id=eq.${enc(personaId)}&month=eq.${enc(month)}&limit=1`,
  );
  return rows[0] ?? null;
}

/** Atomic running-total increment via the SQL function from migration 015. */
export async function incrementUsage(
  personaId: string,
  month: string,
  deltas: { messages: number; tokens: number },
): Promise<void> {
  await rest<undefined>("rpc/increment_persona_usage", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      p_persona_id: personaId,
      p_month: month,
      p_messages: deltas.messages,
      p_tokens: deltas.tokens,
    },
  });
}

// ── subscriptions (tier lookup) ───────────────────────────────────────────────────────────

export async function fetchSubscriptionStatus(businessId: string): Promise<string | null> {
  const rows = await rest<{ status: string }[]>(
    `pocket_agent_subscriptions?user_id=eq.${enc(businessId)}&order=updated_at.desc&select=status&limit=1`,
  );
  return rows[0]?.status ?? null;
}

/** Best-effort owner email for the weekly digest (from their subscription row). */
export async function fetchOwnerEmail(businessId: string): Promise<string | null> {
  const rows = await rest<{ email: string | null }[]>(
    `pocket_agent_subscriptions?user_id=eq.${enc(businessId)}&order=updated_at.desc&select=email&limit=1`,
  );
  return rows[0]?.email ?? null;
}

// ── persona_rate_limits (Wave 2) ────────────────────────────────────────────────────────

/** Atomic increment-and-return of one rate-limit window (RPC from migration 016). */
export async function incrementRateLimit(params: {
  personaId: string;
  scope: RateLimitScope;
  ip: string;
  sessionId: string;
  windowStart: string;
}): Promise<number> {
  const count = await rest<number>("rpc/persona_rate_limit_hit", {
    method: "POST",
    body: {
      p_persona_id: params.personaId,
      p_scope: params.scope,
      p_ip: params.ip,
      p_session: params.sessionId,
      p_window_start: params.windowStart,
    },
  });
  return typeof count === "number" ? count : 0;
}

// ── persona_usage_monthly cap-notify (Wave 2) ───────────────────────────────────────────

/**
 * Flips a monthly cap-notification threshold (50/80/100) exactly once and reports whether
 * THIS call did it (RPC from migration 016) — so the owner email fires a single time per
 * threshold per month even under concurrent requests.
 */
export async function markCapNotified(
  personaId: string,
  month: string,
  threshold: 50 | 80 | 100,
): Promise<boolean> {
  const fired = await rest<boolean>("rpc/mark_persona_cap_notified", {
    method: "POST",
    body: { p_persona_id: personaId, p_month: month, p_threshold: threshold },
  });
  return fired === true;
}

// ── persona_leads (Wave 2) ──────────────────────────────────────────────────────────────

export async function insertLead(row: {
  persona_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  conversation_id: string | null;
  source: LeadSource;
}): Promise<PersonaLeadRow> {
  const rows = await rest<PersonaLeadRow[]>("persona_leads", {
    method: "POST",
    prefer: "return=representation",
    body: { ...row, status: "new" },
  });
  if (!rows[0]) throw new PersonaDbError("Lead insert returned no row");
  return rows[0];
}

export async function listLeads(personaId: string, limit = 200): Promise<PersonaLeadRow[]> {
  return rest<PersonaLeadRow[]>(
    `persona_leads?persona_id=eq.${enc(personaId)}&order=created_at.desc&limit=${limit}`,
  );
}

export async function fetchLead(id: string): Promise<PersonaLeadRow | null> {
  const rows = await rest<PersonaLeadRow[]>(`persona_leads?id=eq.${enc(id)}&limit=1`);
  return rows[0] ?? null;
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<PersonaLeadRow | null> {
  const rows = await rest<PersonaLeadRow[]>(`persona_leads?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { status },
  });
  return rows[0] ?? null;
}

// ── persona_widget_config (Wave 2) ──────────────────────────────────────────────────────

export async function fetchWidgetConfig(
  personaId: string,
): Promise<PersonaWidgetConfigRow | null> {
  const rows = await rest<PersonaWidgetConfigRow[]>(
    `persona_widget_config?persona_id=eq.${enc(personaId)}&limit=1`,
  );
  return rows[0] ?? null;
}

/** Upserts a persona's widget config (PK = persona_id), merging the provided patch. */
export async function upsertWidgetConfig(
  personaId: string,
  patch: WidgetConfigUpdate,
): Promise<PersonaWidgetConfigRow> {
  const rows = await rest<PersonaWidgetConfigRow[]>("persona_widget_config?on_conflict=persona_id", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: { persona_id: personaId, ...patch, updated_at: new Date().toISOString() },
  });
  if (!rows[0]) throw new PersonaDbError("Widget config upsert returned no row");
  return rows[0];
}
