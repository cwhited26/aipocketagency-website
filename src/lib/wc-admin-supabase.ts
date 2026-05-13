type ApaLeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  status: "new";
  /**
   * Set when the lead came in through a "Coming Soon" waitlist surface
   * (Capture Pack / Output Pack landing pages) rather than a $15 kit
   * checkout funnel. NULL for every kit-funnel lead. Column added in
   * wc-admin migration 058_apa_leads_waitlist_for.sql.
   */
  waitlist_for?: string | null;
};

type InsertResult = { ok: true } | { ok: false; status: number; error: string };

type MarkLeadPaidArgs = {
  leadId: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
  /** Set when the buyer accepted the +$10 order bump at checkout. */
  bumpedKitSlug?: string | null;
};

type MarkBundleArgs = {
  leadId: string;
  bundleSessionId: string;
  bundlePaymentIntentId: string | null;
};

type LeadWithFunnel = {
  id: string;
  name: string | null;
  email: string;
  source: string;
  status: string;
  bumped_kit_slug: string | null;
  bundle_upgraded: boolean;
  bundle_stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

type EmailEventArgs = {
  leadId: string;
  emailId: string;
  event: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed";
};

export type DripAudience = "purchaser" | "abandoned";

export type DripEmailRow = {
  id: string;
  slug: string;
  day_offset: number;
  subject: string;
  preheader: string;
  html_body: string;
  text_body: string;
  /**
   * NULL = applies to every paid APA lead (generic nurture).
   * '<kit-slug>' = applies only to leads with `apa_leads.source = <kit-slug>`.
   */
  kit_source: string | null;
  audience: DripAudience;
  /**
   * Abandoned-cart drips use minute-level delay (60 / 1440 / 4320) anchored
   * on `apa_leads.created_at`. Purchaser drips have delay_minutes NULL and
   * use `day_offset` instead.
   */
  delay_minutes: number | null;
};

export type DripLeadRow = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  status: string;
  drip_subscribed: boolean;
  created_at: string;
  email_sequence_state: Record<string, unknown>;
};

export type AbandonedDripLeadRow = DripLeadRow & {
  checkout_status: "pending" | "abandoned" | "payment_failed" | "completed" | null;
};

export type CheckoutStatus =
  | "pending"
  | "completed"
  | "abandoned"
  | "payment_failed";

type FetchResult<T> = { ok: true; rows: T[] } | { ok: false; status: number; error: string };

function supabaseEnv(): { url: string; key: string } | { error: string } {
  const url = process.env.WC_ADMIN_SUPABASE_URL;
  const key = process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return { error: "WC_ADMIN_SUPABASE_URL / WC_ADMIN_SUPABASE_SERVICE_KEY not set" };
  }
  return { url, key };
}

export async function insertApaLead(row: ApaLeadRow): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function markApaLeadPaid(args: MarkLeadPaidArgs): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads?id=eq.${encodeURIComponent(args.leadId)}`;
  const patch: Record<string, string | null> = {
    status: "paid",
    checkout_status: "completed",
    stripe_customer_id: args.stripeCustomerId,
    stripe_payment_intent_id: args.stripePaymentIntentId,
    updated_at: new Date().toISOString(),
  };
  if (args.bumpedKitSlug !== undefined) {
    patch.bumped_kit_slug = args.bumpedKitSlug;
  }
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function markApaLeadBundleUpgraded(
  args: MarkBundleArgs,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }
  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads?id=eq.${encodeURIComponent(args.leadId)}`;
  const patch: Record<string, string | boolean | null> = {
    bundle_upgraded: true,
    bundle_stripe_session_id: args.bundleSessionId,
    bundle_stripe_payment_intent_id: args.bundlePaymentIntentId,
    bundle_paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

type FetchLeadFunnelResult =
  | { ok: true; lead: LeadWithFunnel | null }
  | { ok: false; status: number; error: string };

export async function fetchLeadFunnelById(
  leadId: string,
): Promise<FetchLeadFunnelResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }
  const cols = [
    "id",
    "name",
    "email",
    "source",
    "status",
    "bumped_kit_slug",
    "bundle_upgraded",
    "bundle_stripe_session_id",
    "stripe_payment_intent_id",
  ].join(",");
  const endpoint =
    `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads` +
    `?select=${cols}&id=eq.${encodeURIComponent(leadId)}&limit=1`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as LeadWithFunnel[];
  return { ok: true, lead: rows[0] ?? null };
}

export async function fetchActiveDripEmails(): Promise<FetchResult<DripEmailRow>> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint =
    `${env.url.replace(/\/$/, "")}/rest/v1/apa_drip_emails` +
    `?select=id,slug,day_offset,subject,preheader,html_body,text_body,kit_source,audience,delay_minutes` +
    `&active=eq.true&order=audience.asc,day_offset.asc,delay_minutes.asc`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as DripEmailRow[];
  return { ok: true, rows };
}

/**
 * Leads in any pre-completed Stripe state (pending, abandoned, payment_failed)
 * that are still drip_subscribed. The drip sweep walks these against the
 * audience='abandoned' drip rows and fires the next delay_minutes bucket
 * each lead is due for.
 *
 * `status` is intentionally NOT filtered here — checkout_status='completed'
 * leads have already paid (status flips to 'paid' in the same webhook),
 * but the explicit IN-clause on the three non-completed values is the
 * safer filter and short-circuits at the database.
 */
export async function fetchAbandonedDripEligibleLeads(
  limit: number,
): Promise<FetchResult<AbandonedDripLeadRow>> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint =
    `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads` +
    `?select=id,email,name,source,status,drip_subscribed,created_at,email_sequence_state,checkout_status` +
    `&checkout_status=in.(pending,abandoned,payment_failed)` +
    `&drip_subscribed=eq.true` +
    `&order=created_at.asc&limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as AbandonedDripLeadRow[];
  return { ok: true, rows };
}

type MarkCheckoutStatusArgs = {
  leadId: string;
  status: CheckoutStatus;
  stripeSessionId?: string | null;
  expiredAt?: string | null;
};

/**
 * Stamp `checkout_status` on an apa_leads row. Used by:
 *   • Stripe session creation (status='pending' + stripeSessionId)
 *   • Webhook checkout.session.expired (status='abandoned' + expiredAt)
 *   • Webhook payment_intent.payment_failed (status='payment_failed')
 *   • Webhook checkout.session.completed (status='completed' — flips lead
 *     out of the abandoned-drip eligible cohort)
 *
 * Additive PATCH — does NOT touch existing columns like status, source,
 * email_sequence_state. The drip sweep stops the abandoned sequence for a
 * given lead as soon as checkout_status leaves the eligible IN-list.
 */
export async function markApaLeadCheckoutStatus(
  args: MarkCheckoutStatusArgs,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads?id=eq.${encodeURIComponent(args.leadId)}`;
  const patch: Record<string, string | null> = {
    checkout_status: args.status,
    updated_at: new Date().toISOString(),
  };
  if (args.stripeSessionId !== undefined) {
    patch.stripe_session_id = args.stripeSessionId;
  }
  if (args.expiredAt !== undefined) {
    patch.checkout_expired_at = args.expiredAt;
  }
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

type FindLeadByStripeSessionResult =
  | { ok: true; leadId: string | null }
  | { ok: false; status: number; error: string };

/**
 * Webhook fallback path: when checkout.session.expired or
 * payment_intent.payment_failed fires and we can't get a `lead_id` from
 * metadata or client_reference_id, look up the lead by the stamped
 * `stripe_session_id`.
 */
export async function findLeadIdByStripeSessionId(
  sessionId: string,
): Promise<FindLeadByStripeSessionResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }
  const endpoint =
    `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads` +
    `?select=id&stripe_session_id=eq.${encodeURIComponent(sessionId)}&limit=1`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  return { ok: true, leadId: rows[0]?.id ?? null };
}

export async function fetchDripEligibleLeads(
  limit: number,
): Promise<FetchResult<DripLeadRow>> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint =
    `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads` +
    `?select=id,email,name,source,status,drip_subscribed,created_at,email_sequence_state` +
    `&status=in.(paid,member)&drip_subscribed=eq.true` +
    `&order=created_at.asc&limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as DripLeadRow[];
  return { ok: true, rows };
}

export async function updateLeadSequenceState(
  leadId: string,
  sequenceState: Record<string, unknown>,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads?id=eq.${encodeURIComponent(leadId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      email_sequence_state: sequenceState,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

type LeadByIdResult =
  | { ok: true; lead: DripLeadRow | null }
  | { ok: false; status: number; error: string };

export async function fetchLeadById(leadId: string): Promise<LeadByIdResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint =
    `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads` +
    `?select=id,email,name,source,status,drip_subscribed,created_at,email_sequence_state` +
    `&id=eq.${encodeURIComponent(leadId)}&limit=1`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as DripLeadRow[];
  return { ok: true, lead: rows[0] ?? null };
}

export async function setLeadDripSubscribed(
  leadId: string,
  subscribed: boolean,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_leads?id=eq.${encodeURIComponent(leadId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      drip_subscribed: subscribed,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function insertApaEmailEvent(args: EmailEventArgs): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) {
    return { ok: false, status: 500, error: env.error };
  }

  const endpoint = `${env.url.replace(/\/$/, "")}/rest/v1/apa_email_events`;
  const row = {
    lead_id: args.leadId,
    email_id: args.emailId,
    event: args.event,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}
