// lib/vision/log.ts — data layer for pa_vision_log (migration 034), the structured log of every
// Claude vision OCR attempt on an uploaded image/PDF. Successes record token usage + USD cost;
// failures record ok=false + the error, so a graceful OCR failure leaves a real row instead of a
// silent catch. Service-role REST, no SDK — mirrors lib/connectors/system/log.ts.

type LogResult = { ok: true } | { ok: false; error: string };

const TABLE = "pa_vision_log";

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

export type VisionLogRow = {
  userId: string;
  /** The stored asset path (assets/<file>) the OCR ran against. */
  fileUrl: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  ok: boolean;
  /** Failure reason when ok=false. */
  error?: string | null;
};

/**
 * Inserts one pa_vision_log row. Returns a typed result; the caller decides what a logging
 * failure means (here: it must never break the upload, so callers swallow {ok:false} after
 * surfacing it). Never throws.
 */
export async function logVisionAttempt(row: VisionLogRow): Promise<LogResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: row.userId,
        file_url: row.fileUrl,
        prompt_tokens: row.promptTokens,
        completion_tokens: row.completionTokens,
        cost_usd: row.costUsd,
        ok: row.ok,
        error: row.error ?? null,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "vision log insert failed" };
  }
  if (!res.ok) return { ok: false, error: `vision log insert returned ${res.status}` };
  return { ok: true };
}
