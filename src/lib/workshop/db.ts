// lib/workshop/db.ts — service-role data layer for the Business Brain Workshop (migration 107).
// Direct PostgREST, no SDK — matches lib/emails/queue.ts and lib/rituals/db.ts. Every write rides
// the service-role key from gated routes; RLS scopes owner-facing reads.

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const REGISTRATIONS = "pa_workshop_registrations";
const ATTENDANCE = "pa_workshop_attendance";
const BUMPS = "pa_workshop_bump_purchases";
const OTOS = "pa_workshop_oto_purchases";
const PASSES = "pa_backstage_passes";
const CHAT = "pa_workshop_chat_messages";

export type WorkshopSessionStatus = "registered" | "attended" | "no_show" | "canceled";

export type WorkshopRegistrationRow = {
  id: string;
  owner_id: string | null;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;
  stripe_session_id: string | null;
  chosen_slot_at: string;
  timezone: string;
  bump_selected: boolean;
  session_status: WorkshopSessionStatus;
  created_at: string;
};

export type WorkshopAttendanceRow = {
  registration_id: string;
  current_video_position_sec: number;
  forked_repo_url: string | null;
  forked_repo_full_name: string | null;
  github_login: string | null;
  github_token_encrypted: string | null;
  zones_completed: string[];
  connected_to_pa: boolean;
  exit_at: string | null;
  last_active_at: string | null;
};

export type WorkshopOtoRow = {
  id: string;
  registration_id: string;
  oto_number: number;
  product_slug: string;
  amount_cents: number;
  stripe_payment_intent_id: string | null;
  status: "succeeded" | "failed" | "declined";
  purchased_at: string;
};

function env(): { url: string; key: string } | { error: string } {
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
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest<T>(
  path: string,
  init: RequestInit & { headers: Record<string, string> },
): Promise<PaResult<T>> {
  const e = env();
  if ("error" in e) return { ok: false, status: 500, error: e.error };
  const res = await fetch(`${e.url}/rest/v1/${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  if (res.status === 204 || init.headers.Prefer === "return=minimal") {
    return { ok: true, data: undefined as T };
  }
  return { ok: true, data: (await res.json()) as T };
}

function svc(extra?: Record<string, string>): Record<string, string> {
  const e = env();
  return "error" in e ? {} : headers(e.key, extra);
}

// ── Registrations ────────────────────────────────────────────────────────────────────────────────

export async function insertWorkshopRegistration(args: {
  email: string;
  name: string | null;
  chosenSlotAt: string;
  timezone: string;
  bumpSelected: boolean;
}): Promise<PaResult<WorkshopRegistrationRow>> {
  const r = await rest<WorkshopRegistrationRow[]>(REGISTRATIONS, {
    method: "POST",
    headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify({
      email: args.email,
      name: args.name,
      chosen_slot_at: args.chosenSlotAt,
      timezone: args.timezone,
      bump_selected: args.bumpSelected,
    }),
  });
  if (!r.ok) return r;
  const row = r.data[0];
  if (!row) return { ok: false, status: 502, error: "insert returned no row" };
  return { ok: true, data: row };
}

export async function getWorkshopRegistration(
  id: string,
): Promise<PaResult<WorkshopRegistrationRow | null>> {
  const r = await rest<WorkshopRegistrationRow[]>(
    `${REGISTRATIONS}?id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: "GET", headers: svc() },
  );
  if (!r.ok) return r;
  return { ok: true, data: r.data[0] ?? null };
}

export async function getWorkshopRegistrationBySession(
  stripeSessionId: string,
): Promise<PaResult<WorkshopRegistrationRow | null>> {
  const r = await rest<WorkshopRegistrationRow[]>(
    `${REGISTRATIONS}?stripe_session_id=eq.${encodeURIComponent(stripeSessionId)}&limit=1`,
    { method: "GET", headers: svc() },
  );
  if (!r.ok) return r;
  return { ok: true, data: r.data[0] ?? null };
}

export async function patchWorkshopRegistration(
  id: string,
  patch: Partial<{
    owner_id: string;
    stripe_customer_id: string;
    stripe_session_id: string;
    session_status: WorkshopSessionStatus;
  }>,
): Promise<PaResult<void>> {
  return rest<void>(`${REGISTRATIONS}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: svc({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
}

// ── Attendance ───────────────────────────────────────────────────────────────────────────────────

export async function getWorkshopAttendance(
  registrationId: string,
): Promise<PaResult<WorkshopAttendanceRow | null>> {
  const r = await rest<WorkshopAttendanceRow[]>(
    `${ATTENDANCE}?registration_id=eq.${encodeURIComponent(registrationId)}&limit=1`,
    { method: "GET", headers: svc() },
  );
  if (!r.ok) return r;
  return { ok: true, data: r.data[0] ?? null };
}

/** Upsert-merge the attendance row (registration_id is the PK, so retries merge). */
export async function upsertWorkshopAttendance(
  registrationId: string,
  patch: Partial<Omit<WorkshopAttendanceRow, "registration_id">>,
): Promise<PaResult<void>> {
  return rest<void>(`${ATTENDANCE}?on_conflict=registration_id`, {
    method: "POST",
    headers: svc({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ registration_id: registrationId, ...patch }),
  });
}

/** Append a zone to zones_completed without clobbering concurrent writes (read-merge-write). */
export async function markWorkshopZoneCompleted(
  registrationId: string,
  zone: string,
): Promise<PaResult<void>> {
  const current = await getWorkshopAttendance(registrationId);
  if (!current.ok) return current;
  const zones = new Set(current.data?.zones_completed ?? []);
  zones.add(zone);
  return upsertWorkshopAttendance(registrationId, { zones_completed: [...zones] });
}

// ── Purchases ────────────────────────────────────────────────────────────────────────────────────

export async function insertWorkshopBumpPurchase(args: {
  registrationId: string;
  stripeLineItemId: string | null;
  productSlug: string;
  amountCents: number;
}): Promise<PaResult<void>> {
  return rest<void>(`${BUMPS}?on_conflict=registration_id,product_slug`, {
    method: "POST",
    headers: svc({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      registration_id: args.registrationId,
      stripe_line_item_id: args.stripeLineItemId,
      product_slug: args.productSlug,
      amount_cents: args.amountCents,
    }),
  });
}

export async function upsertWorkshopOtoPurchase(args: {
  registrationId: string;
  otoNumber: 1 | 2;
  productSlug: string;
  amountCents: number;
  stripePaymentIntentId: string | null;
  status: "succeeded" | "failed" | "declined";
}): Promise<PaResult<void>> {
  return rest<void>(`${OTOS}?on_conflict=registration_id,oto_number`, {
    method: "POST",
    headers: svc({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      registration_id: args.registrationId,
      oto_number: args.otoNumber,
      product_slug: args.productSlug,
      amount_cents: args.amountCents,
      stripe_payment_intent_id: args.stripePaymentIntentId,
      status: args.status,
    }),
  });
}

export async function listWorkshopOtoPurchases(
  registrationId: string,
): Promise<PaResult<WorkshopOtoRow[]>> {
  return rest<WorkshopOtoRow[]>(
    `${OTOS}?registration_id=eq.${encodeURIComponent(registrationId)}&order=oto_number.asc`,
    { method: "GET", headers: svc() },
  );
}

export async function insertBackstagePass(args: {
  ownerId: string | null;
  registrationId: string;
  stripePaymentIntentId: string | null;
}): Promise<PaResult<void>> {
  return rest<void>(`${PASSES}?on_conflict=stripe_payment_intent_id`, {
    method: "POST",
    headers: svc({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      owner_id: args.ownerId,
      registration_id: args.registrationId,
      stripe_payment_intent_id: args.stripePaymentIntentId,
    }),
  });
}

// ── Chat ─────────────────────────────────────────────────────────────────────────────────────────

export async function insertWorkshopChatMessage(args: {
  registrationId: string;
  senderName: string;
  message: string;
}): Promise<PaResult<void>> {
  return rest<void>(CHAT, {
    method: "POST",
    headers: svc({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      registration_id: args.registrationId,
      sender_name: args.senderName,
      message: args.message,
    }),
  });
}

// ── Operator analytics (/admin/workshop) ─────────────────────────────────────────────────────────

async function countRows(pathWithFilter: string): Promise<number> {
  const e = env();
  if ("error" in e) return 0;
  const res = await fetch(`${e.url}/rest/v1/${pathWithFilter}`, {
    method: "HEAD",
    headers: { ...headers(e.key), Prefer: "count=exact" },
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range");
  const total = range?.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}

export type WorkshopAdminReport = {
  registrations: number;
  attended: number;
  noShows: number;
  bumps: number;
  oto1Taken: number;
  oto1Offered: number;
  oto2Taken: number;
  oto2Offered: number;
  backstagePasses: number;
  workshopTrials: number;
  workshopTrialsActive: number;
  workshopStudioUpgrades: number;
  recentChat: Array<{
    registration_id: string;
    sender_name: string;
    message: string;
    created_at: string;
  }>;
};

export async function buildWorkshopAdminReport(): Promise<WorkshopAdminReport> {
  const [
    registrations,
    attended,
    noShows,
    bumps,
    oto1Taken,
    oto1Offered,
    oto2Taken,
    oto2Offered,
    backstagePasses,
    workshopTrials,
    workshopTrialsActive,
    workshopStudioUpgrades,
  ] = await Promise.all([
    countRows(`${REGISTRATIONS}?select=id`),
    countRows(`${REGISTRATIONS}?select=id&session_status=eq.attended`),
    countRows(`${REGISTRATIONS}?select=id&session_status=eq.no_show`),
    countRows(`${BUMPS}?select=id`),
    countRows(`${OTOS}?select=id&oto_number=eq.1&status=eq.succeeded`),
    countRows(`${OTOS}?select=id&oto_number=eq.1`),
    countRows(`${OTOS}?select=id&oto_number=eq.2&status=eq.succeeded`),
    countRows(`${OTOS}?select=id&oto_number=eq.2`),
    countRows(`${PASSES}?select=id&active=eq.true`),
    countRows(`pocket_agent_subscriptions?select=id&trial_source=eq.workshop`),
    countRows(`pocket_agent_subscriptions?select=id&trial_source=eq.workshop&status=eq.active`),
    countRows(
      `pocket_agent_subscriptions?select=id&trial_source=eq.workshop&tier=in.(studio,studio_plus)`,
    ),
  ]);

  const chat = await rest<WorkshopAdminReport["recentChat"]>(
    `${CHAT}?select=registration_id,sender_name,message,created_at&order=created_at.desc&limit=100`,
    { method: "GET", headers: svc() },
  );

  return {
    registrations,
    attended,
    noShows,
    bumps,
    oto1Taken,
    oto1Offered,
    oto2Taken,
    oto2Offered,
    backstagePasses,
    workshopTrials,
    workshopTrialsActive,
    workshopStudioUpgrades,
    recentChat: chat.ok ? chat.data : [],
  };
}

/** Best-effort trial_source stamp on the subscription row (analytics only, never blocks). */
export async function stampTrialSourceWorkshop(email: string): Promise<PaResult<void>> {
  return rest<void>(
    `pocket_agent_subscriptions?email=eq.${encodeURIComponent(email.toLowerCase())}`,
    {
      method: "PATCH",
      headers: svc({ Prefer: "return=minimal" }),
      body: JSON.stringify({ trial_source: "workshop" }),
    },
  );
}
