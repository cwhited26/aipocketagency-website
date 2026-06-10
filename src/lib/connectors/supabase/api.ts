// connectors/supabase/api.ts — the thin direct-REST client for the Supabase Management API
// (https://api.supabase.com/v1). No @supabase/supabase-js, no management SDK — plain fetch with
// the owner's Personal Access Token as a Bearer, mirroring the no-SDK rule every other PA
// connector follows (Slack / QuickBooks / Stripe call their providers the same way).
//
// Every method returns a typed result ({ ok, data } | { ok:false, status, error, authError }); a
// 401/403 sets authError so the caller can flip the connection to status='error' and prompt the
// owner to re-paste their token. Never a thrown error on a normal API failure, never a silent
// catch.

const MGMT_BASE = "https://api.supabase.com/v1";

export type MgmtResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

export type SupabaseOrganization = { id: string; name: string };

export type SupabaseProject = {
  id: string;
  ref: string;
  name: string;
  organizationId: string;
  region: string;
  status: string;
  databaseHost: string | null;
};

// A row returned by the database/query endpoint. Postgres column → value; shape is query-defined.
export type SqlRow = Record<string, unknown>;

function authHeaders(pat: string): Record<string, string> {
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}

// Normalize a non-2xx Management API response into a typed failure. 401/403 → authError so the
// caller re-prompts for the token; everything else carries the upstream status + a trimmed body.
async function failure<T>(res: Response): Promise<MgmtResult<T>> {
  const body = (await res.text()).slice(0, 600);
  return {
    ok: false,
    status: res.status,
    error: body || `Supabase Management API returned ${res.status}`,
    authError: res.status === 401 || res.status === 403,
  };
}

/** GET /v1/organizations — used at connect/test time and to default createProject's org. */
export async function listOrganizations(pat: string): Promise<MgmtResult<SupabaseOrganization[]>> {
  let res: Response;
  try {
    res = await fetch(`${MGMT_BASE}/organizations`, {
      method: "GET",
      headers: authHeaders(pat),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: networkError(e), authError: false };
  }
  if (!res.ok) return failure(res);
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw)) {
    return { ok: false, status: 502, error: "Unexpected organizations response shape.", authError: false };
  }
  const orgs: SupabaseOrganization[] = [];
  for (const o of raw) {
    if (o && typeof o === "object" && typeof (o as { id?: unknown }).id === "string") {
      const row = o as { id: string; name?: unknown };
      orgs.push({ id: row.id, name: typeof row.name === "string" ? row.name : row.id });
    }
  }
  return { ok: true, data: orgs };
}

export type CreateProjectArgs = {
  organizationId: string;
  name: string;
  region: string;
  dbPass: string;
  plan: string;
};

/** POST /v1/projects — provisions a new project in the owner's org. Returns the project ref. */
export async function createProject(
  pat: string,
  args: CreateProjectArgs,
): Promise<MgmtResult<SupabaseProject>> {
  let res: Response;
  try {
    res = await fetch(`${MGMT_BASE}/projects`, {
      method: "POST",
      headers: authHeaders(pat),
      cache: "no-store",
      body: JSON.stringify({
        organization_id: args.organizationId,
        name: args.name,
        region: args.region,
        db_pass: args.dbPass,
        plan: args.plan,
      }),
    });
  } catch (e) {
    return { ok: false, status: 502, error: networkError(e), authError: false };
  }
  if (!res.ok) return failure(res);
  const raw = (await res.json()) as Record<string, unknown>;
  const ref = typeof raw.ref === "string" ? raw.ref : typeof raw.id === "string" ? raw.id : null;
  if (!ref) {
    return { ok: false, status: 502, error: "Project created but no ref was returned.", authError: false };
  }
  return { ok: true, data: normalizeProject(raw, ref) };
}

/** GET /v1/projects/{ref} — used by get_connection_string for the database host. */
export async function getProject(pat: string, ref: string): Promise<MgmtResult<SupabaseProject>> {
  let res: Response;
  try {
    res = await fetch(`${MGMT_BASE}/projects/${encodeURIComponent(ref)}`, {
      method: "GET",
      headers: authHeaders(pat),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: networkError(e), authError: false };
  }
  if (!res.ok) return failure(res);
  const raw = (await res.json()) as Record<string, unknown>;
  return { ok: true, data: normalizeProject(raw, ref) };
}

/**
 * POST /v1/projects/{ref}/database/query — runs SQL against the project DB. Used by
 * apply_migration, seed_data (mutating) and run_sql_read_only (the query is guarded upstream by
 * sql-guard before it reaches here — this client never inspects intent, it just transports).
 */
export async function runQuery(
  pat: string,
  ref: string,
  query: string,
): Promise<MgmtResult<SqlRow[]>> {
  let res: Response;
  try {
    res = await fetch(`${MGMT_BASE}/projects/${encodeURIComponent(ref)}/database/query`, {
      method: "POST",
      headers: authHeaders(pat),
      cache: "no-store",
      body: JSON.stringify({ query }),
    });
  } catch (e) {
    return { ok: false, status: 502, error: networkError(e), authError: false };
  }
  if (!res.ok) return failure(res);
  const raw = (await res.json()) as unknown;
  // The endpoint returns a JSON array of result rows (empty for statements with no result set).
  if (Array.isArray(raw)) return { ok: true, data: raw as SqlRow[] };
  // Some responses wrap rows under { result: [...] }; accept that shape too.
  if (raw && typeof raw === "object" && Array.isArray((raw as { result?: unknown }).result)) {
    return { ok: true, data: (raw as { result: SqlRow[] }).result };
  }
  return { ok: true, data: [] };
}

export type SupabaseApiKeys = { anonKey: string | null; serviceRoleKey: string | null };

/**
 * GET /v1/projects/{ref}/api-keys — the project's anon + service_role keys. Used by the Idea Engine
 * to inject NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY into the matching Vercel
 * project. The response is an array of { name, api_key }; we read the two named entries. A freshly
 * created project that is still coming up may return neither — the caller decides how to degrade.
 */
export async function getProjectApiKeys(pat: string, ref: string): Promise<MgmtResult<SupabaseApiKeys>> {
  let res: Response;
  try {
    res = await fetch(`${MGMT_BASE}/projects/${encodeURIComponent(ref)}/api-keys`, {
      method: "GET",
      headers: authHeaders(pat),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: networkError(e), authError: false };
  }
  if (!res.ok) return failure(res);
  const raw = (await res.json()) as unknown;
  const keys: SupabaseApiKeys = { anonKey: null, serviceRoleKey: null };
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const name = (entry as { name?: unknown }).name;
      const apiKey = (entry as { api_key?: unknown }).api_key;
      if (typeof name !== "string" || typeof apiKey !== "string") continue;
      if (name === "anon") keys.anonKey = apiKey;
      else if (name === "service_role") keys.serviceRoleKey = apiKey;
    }
  }
  return { ok: true, data: keys };
}

function normalizeProject(raw: Record<string, unknown>, ref: string): SupabaseProject {
  const db = raw.database && typeof raw.database === "object" ? (raw.database as Record<string, unknown>) : {};
  return {
    id: typeof raw.id === "string" ? raw.id : ref,
    ref,
    name: typeof raw.name === "string" ? raw.name : ref,
    organizationId: typeof raw.organization_id === "string" ? raw.organization_id : "",
    region: typeof raw.region === "string" ? raw.region : "",
    status: typeof raw.status === "string" ? raw.status : "UNKNOWN",
    databaseHost: typeof db.host === "string" ? db.host : null,
  };
}

function networkError(e: unknown): string {
  return `Couldn't reach the Supabase Management API: ${e instanceof Error ? e.message : "network error"}`;
}
