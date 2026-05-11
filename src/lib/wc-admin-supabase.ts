type ApaLeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  status: "new";
};

type InsertResult = { ok: true } | { ok: false; status: number; error: string };

type MarkLeadPaidArgs = {
  leadId: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
};

type EmailEventArgs = {
  leadId: string;
  emailId: string;
  event: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";
};

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
    stripe_customer_id: args.stripeCustomerId,
    stripe_payment_intent_id: args.stripePaymentIntentId,
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
