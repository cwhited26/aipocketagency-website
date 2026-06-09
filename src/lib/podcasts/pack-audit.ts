// pack-audit.ts — record a podcast-pack subscription as a zero-cost audit row in the cost ledger
// (pa_cost_events). PA-PC-14: a pack subscribe spins up a watch per show but incurs no model spend at
// subscribe time (the Whisper/Haiku cost lands later, per episode, through the Phase-1 ingester). We
// still want the subscription visible in the ledger for observability, so we write one row with
// backend 'audit', cost 0, and the pack + show count in metadata. Backend 'audit' (vs a real priced
// backend) keeps cost-by-backend reports honest — a 0-µ¢ audit row can't distort spend.
//
// Written directly via service-role REST (not logCostEvent, whose typed backend is for priced calls).
// Never throws — an audit miss can't be allowed to fail the subscription it's recording.

function paEnv(): { url: string; key: string } | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/** Records one `subscription_started` audit event for a pack subscribe (no cost). Best-effort. */
export async function logPackSubscriptionAudit(params: {
  ownerId: string;
  packSlug: string;
  showCount: number;
}): Promise<void> {
  const env = paEnv();
  if (!env) return;
  const row = {
    owner_id: params.ownerId,
    feature_slug: "podcast",
    backend: "audit",
    model: null,
    cost_micro_cents: 0,
    metadata: {
      event: "subscription_started",
      pack_slug: params.packSlug,
      show_count: String(params.showCount),
    },
  };
  try {
    await fetch(`${env.url}/rest/v1/pa_cost_events`, {
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
  } catch {
    // An audit-row miss is non-fatal — the subscription itself already succeeded.
  }
}
