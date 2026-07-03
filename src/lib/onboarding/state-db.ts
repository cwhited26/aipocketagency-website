// state-db.ts — data-access layer for pa_onboarding_state (migration 099, PA-POS-22) plus the
// pocket_agent_users.vertical mirror. Direct PostgREST with the service-role key, mirroring
// lib/personas/db.ts. Throws OnboardingDbError on a hard failure (never a silent catch); the
// callers that must stay non-fatal (the seeder, the onboarding gate) catch and log at their level.

import { onboardingLog } from "./log";
import { markOnboardingStepComplete } from "./progress";

export class OnboardingDbError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "OnboardingDbError";
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
    throw new OnboardingDbError("Supabase env vars not set", 500);
  }
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH";
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
    throw new OnboardingDbError(
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

export type OnboardingStateRow = {
  owner_id: string;
  vertical: string | null;
  vertical_picked_at: string | null;
  personas_seeded_at: string | null;
  seeded_persona_slugs: string[];
  suggested_app_ids: string[];
  created_at: string;
  updated_at: string;
};

export async function fetchOnboardingState(ownerId: string): Promise<OnboardingStateRow | null> {
  const rows = await rest<OnboardingStateRow[]>(
    `pa_onboarding_state?owner_id=eq.${enc(ownerId)}&limit=1`,
  );
  return rows[0] ?? null;
}

/**
 * Records the owner's vertical decision: the pa_onboarding_state upsert plus the
 * pocket_agent_users.vertical mirror. A skip is vertical=null with vertical_picked_at set —
 * "decided, wants the empty workspace" — so the onboarding gate never re-asks.
 *
 * The pocket_agent_users write is a column-scoped merge upsert (id + github_username + vertical
 * only) — deliberately NOT initPaUser/upsertPaUser, whose merge bodies carry brain_repo/github_token
 * and would null a connected brain when the owner re-picks.
 */
export async function recordVerticalDecision(input: {
  ownerId: string;
  githubUsername: string;
  vertical: string | null;
  suggestedAppIds: string[];
}): Promise<void> {
  const now = new Date().toISOString();
  await rest<void>("pa_onboarding_state?on_conflict=owner_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      owner_id: input.ownerId,
      vertical: input.vertical,
      vertical_picked_at: now,
      suggested_app_ids: input.suggestedAppIds,
      updated_at: now,
    },
  });
  await rest<void>("pocket_agent_users?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: input.ownerId,
      github_username: input.githubUsername,
      vertical: input.vertical,
      updated_at: now,
    },
  });
}

/** Bookkeeps a seeder run: the cumulative seeded slugs, and the completion stamp once done. */
export async function recordSeededPersonas(input: {
  ownerId: string;
  seededSlugs: string[];
  complete: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  await rest<void>(`pa_onboarding_state?owner_id=eq.${enc(input.ownerId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      seeded_persona_slugs: input.seededSlugs,
      personas_seeded_at: input.complete ? now : null,
      updated_at: now,
    },
  });
  // PA-POS-36: a vertical-picker seed is the other door into "Compose your first agent"
  // (the registry says so). Never throws; a no-op once the step is already complete.
  if (input.seededSlugs.length > 0) {
    await markOnboardingStepComplete(input.ownerId, "compose_agent");
  }
}

/**
 * Whether the owner has made the vertical decision. Fails CLOSED to "decided" on a read error —
 * the onboarding gate must never trap an owner in a redirect loop because migration 099 isn't
 * applied yet or Supabase hiccuped.
 */
export async function hasVerticalDecision(ownerId: string): Promise<boolean> {
  try {
    const row = await fetchOnboardingState(ownerId);
    return Boolean(row?.vertical_picked_at);
  } catch (e) {
    onboardingLog.warn("vertical-decision read failed — gate fails open past the picker", {
      ownerId,
      error: e instanceof Error ? e.message : String(e),
    });
    return true;
  }
}
