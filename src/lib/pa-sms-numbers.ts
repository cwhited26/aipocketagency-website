/**
 * Data layer for pa_sms_numbers (migration 040) — the binding between a PA owner and the dedicated
 * Twilio number that fronts their SMS chat surface. Service-role REST only, no SDK, plain fetch
 * against the Supabase REST API (mirrors pa-zoom-connections.ts / pa-calendar-connections.ts).
 *
 * The Twilio phone SID and the E.164 string are NOT secrets — the per-owner Twilio credential is a
 * single account token on the platform env (TWILIO_AUTH_TOKEN), so there's nothing to encrypt here.
 * Releasing a number is a soft delete: status flips to 'released' and the row stays for history.
 */

export type SmsNumberStatus = "active" | "released" | "error";

export type SmsNumberRow = {
  id: string;
  owner_id: string;
  twilio_phone_sid: string;
  e164_number: string;
  status: SmsNumberStatus;
  created_at: string;
  updated_at: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_sms_numbers";
const FIELDS = "id,owner_id,twilio_phone_sid,e164_number,status,created_at,updated_at";

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

const enc = encodeURIComponent;

// ─── Reads ──────────────────────────────────────────────────────────────────────

/** The owner's currently active number (for the Settings card + provision idempotency). */
export async function fetchActiveSmsNumber(
  ownerId: string,
): Promise<PaResult<SmsNumberRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${enc(ownerId)}&status=eq.active&select=${FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SmsNumberRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Route an inbound text: the active owner bound to the destination (`To`) number. */
export async function fetchSmsNumberByE164(
  e164: string,
): Promise<PaResult<SmsNumberRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?e164_number=eq.${enc(e164)}&status=eq.active&select=${FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SmsNumberRow[];
  return { ok: true, data: rows[0] ?? null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────────

export async function insertSmsNumber(data: {
  ownerId: string;
  twilioPhoneSid: string;
  e164Number: string;
}): Promise<PaResult<SmsNumberRow>> {
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
      owner_id: data.ownerId,
      twilio_phone_sid: data.twilioPhoneSid,
      e164_number: data.e164Number,
      status: "active" satisfies SmsNumberStatus,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SmsNumberRow[];
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "No row returned" };
  return { ok: true, data: row };
}

/** Soft-delete on disconnect: flip the owner's active number to 'released'. Row retained. */
export async function releaseSmsNumber(ownerId: string): Promise<PaResult<void>> {
  return patchActive(ownerId, { status: "released" });
}

/** Mark the owner's number broken (Twilio rejected a send / lost the number). */
export async function markSmsNumberError(ownerId: string): Promise<PaResult<void>> {
  return patchActive(ownerId, { status: "error" });
}

async function patchActive(
  ownerId: string,
  patch: Record<string, unknown>,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${enc(ownerId)}&status=eq.active`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
