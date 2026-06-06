type InsertResult = { ok: true } | { ok: false; status: number; error: string };

export type PocketAgentStatus = "trial" | "active" | "canceled";

export type PocketAgentSubscriptionRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_session_id: string | null;
  status: PocketAgentStatus;
  // SMB ladder tier + dev add-on flags (migration 020). `tier` is null until the
  // Stripe webhook provisions one from the active price ID.
  tier: string | null;
  addon_sync: boolean;
  addon_publish: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_end_reminder_sent_at: string | null;
  welcome_email_sent_at: string | null;
  activated_at: string | null;
  canceled_at: string | null;
  email_sequence_state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function supabaseEnv(): { url: string; key: string } | { error: string } {
  const paUrl = process.env.POCKET_AGENT_SUPABASE_URL;
  const paKey = process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY;
  if (paUrl && paKey) return { url: paUrl, key: paKey };

  const wcUrl = process.env.WC_ADMIN_SUPABASE_URL;
  const wcKey = process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (wcUrl && wcKey) return { url: wcUrl, key: wcKey };

  return {
    error:
      "POCKET_AGENT_SUPABASE_URL + POCKET_AGENT_SUPABASE_SERVICE_KEY (or WC_ADMIN_SUPABASE_* fallback) not set",
  };
}

const TABLE = "pocket_agent_subscriptions";

function endpoint(env: { url: string }, suffix = ""): string {
  return `${env.url.replace(/\/$/, "")}/rest/v1/${TABLE}${suffix}`;
}

export async function upsertPocketAgentTrial(args: {
  email: string;
  name: string | null;
  userId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSessionId: string | null;
  trialStartedAt: string;
  trialEndsAt: string | null;
}): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const row: Record<string, unknown> = {
    email: args.email,
    name: args.name,
    stripe_customer_id: args.stripeCustomerId,
    stripe_subscription_id: args.stripeSubscriptionId,
    stripe_session_id: args.stripeSessionId,
    status: "trial" satisfies PocketAgentStatus,
    trial_started_at: args.trialStartedAt,
    trial_ends_at: args.trialEndsAt,
    updated_at: new Date().toISOString(),
  };
  if (args.userId !== null) {
    row.user_id = args.userId;
  }

  // on_conflict must reference a column with a UNIQUE constraint; see
  // migration 005_subscriptions_unique_sub_id.sql.
  const res = await fetch(`${endpoint(env)}?on_conflict=stripe_subscription_id`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
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

export async function markPocketAgentActive(
  stripeSubscriptionId: string,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "active" satisfies PocketAgentStatus,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

/**
 * Write the SMB ladder tier (PA-ORCH-10) onto a subscription row, keyed by Stripe
 * subscription id. Set `tier` to null when the subscription is canceled so the read
 * path falls back to the status-based mapping instead of returning a stale paid tier.
 */
export async function markPocketAgentTier(
  stripeSubscriptionId: string,
  tier: string | null,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ tier, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

/**
 * Toggle a dev add-on flag (PA Sync / PA Publish, SPEC v4 Wave 3) on every
 * subscription row for a customer. Add-ons are sold as separate subscriptions whose
 * own id won't match the customer's SMB row, so we key by stripe_customer_id and let
 * the flag ride on the primary row(s). Orthogonal to `tier` — never touches it.
 */
export async function setPocketAgentAddonByCustomer(args: {
  stripeCustomerId: string;
  addon: "sync" | "publish";
  enabled: boolean;
}): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const column = args.addon === "sync" ? "addon_sync" : "addon_publish";
  const res = await fetch(
    endpoint(env, `?stripe_customer_id=eq.${encodeURIComponent(args.stripeCustomerId)}`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ [column]: args.enabled, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function markPocketAgentCanceled(
  stripeSubscriptionId: string,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "canceled" satisfies PocketAgentStatus,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function markPocketAgentTrialEndNotified(
  stripeSubscriptionId: string,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        trial_end_reminder_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function markWelcomeEmailSent(
  stripeSubscriptionId: string,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        welcome_email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

type FetchByCustomerResult =
  | { ok: true; row: PocketAgentSubscriptionRow | null }
  | { ok: false; status: number; error: string };

export async function fetchPocketAgentByCustomerId(
  stripeCustomerId: string,
): Promise<FetchByCustomerResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}&limit=1`),
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as PocketAgentSubscriptionRow[];
  return { ok: true, row: rows[0] ?? null };
}

type FetchBySubscriptionResult =
  | { ok: true; row: PocketAgentSubscriptionRow | null }
  | { ok: false; status: number; error: string };

export async function fetchPocketAgentBySubscriptionId(
  stripeSubscriptionId: string,
): Promise<FetchBySubscriptionResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(env, `?stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}&limit=1`),
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as PocketAgentSubscriptionRow[];
  return { ok: true, row: rows[0] ?? null };
}

// Claim an email-matched subscription row for a newly-authenticated user.
// Called at auth callback so the middleware's user_id check passes on first login.
export async function linkSubscriptionByEmail(
  email: string,
  userId: string,
): Promise<InsertResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  // Only update rows where user_id is not yet set to avoid overwriting.
  const res = await fetch(
    endpoint(env, `?email=eq.${encodeURIComponent(email)}&user_id=is.null`),
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: userId, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

type CheckByEmailResult =
  | { ok: true; hasActive: boolean }
  | { ok: false; status: number; error: string };

// Email-based subscription check for middleware fallback before user_id is linked.
export async function checkSubscriptionByEmail(email: string): Promise<CheckByEmailResult> {
  const env = supabaseEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    endpoint(
      env,
      `?email=eq.${encodeURIComponent(email)}&status=in.(active,trial)&limit=1`,
    ),
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, hasActive: Array.isArray(rows) && rows.length > 0 };
}
