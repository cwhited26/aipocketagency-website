// prefs.ts — per-owner YouTube preferences (pa_youtube_prefs, migration 042): the Daily-Brief
// "include YouTube ingests" opt-in and the one-time chat-box first-touch hint dismissal. Service-role
// REST, no SDK, typed results — mirrors lib/youtube/log.ts.

export type YouTubePrefs = {
  dailyBriefInclude: boolean;
  chatHintDismissed: boolean;
};

const TABLE = "pa_youtube_prefs";

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

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

type PrefsRow = { daily_brief_include?: boolean; chat_hint_dismissed_at?: string | null };

/** Reads an owner's prefs, defaulting to all-off when no row exists yet. Never throws. */
export async function fetchYouTubePrefs(ownerId: string): Promise<YouTubePrefs> {
  const off: YouTubePrefs = { dailyBriefInclude: false, chatHintDismissed: false };
  const env = paEnv();
  if ("error" in env) return off;

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&select=daily_brief_include,chat_hint_dismissed_at&limit=1`,
      { headers: headers(env.key), cache: "no-store" },
    );
  } catch {
    return off;
  }
  if (!res.ok) return off;
  const rows = (await res.json()) as PrefsRow[];
  const row = rows[0];
  if (!row) return off;
  return {
    dailyBriefInclude: Boolean(row.daily_brief_include),
    chatHintDismissed: Boolean(row.chat_hint_dismissed_at),
  };
}

type UpsertResult = { ok: true } | { ok: false; error: string };

/** Upserts a subset of an owner's prefs (PostgREST merge-duplicates on the owner_id PK). */
export async function upsertYouTubePrefs(
  ownerId: string,
  patch: { dailyBriefInclude?: boolean; chatHintDismissed?: boolean },
): Promise<UpsertResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  const body: Record<string, unknown> = { owner_id: ownerId, updated_at: new Date().toISOString() };
  if (patch.dailyBriefInclude !== undefined) body.daily_brief_include = patch.dailyBriefInclude;
  if (patch.chatHintDismissed !== undefined) {
    body.chat_hint_dismissed_at = patch.chatHintDismissed ? new Date().toISOString() : null;
  }

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id`, {
      method: "POST",
      headers: headers(env.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "prefs upsert failed" };
  }
  if (!res.ok) return { ok: false, error: `prefs upsert returned ${res.status}` };
  return { ok: true };
}
