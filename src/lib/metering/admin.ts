// Operator-side aggregation for /admin/passes (PA-POS-31): the per-App rental leaderboard and
// the rented-vs-tier usage split. Reads ride the service role (the page is isOperatorEmail-gated);
// aggregation happens here in JS over bounded windows — pass volume is small and the cost-event
// read is field-limited. Which Apps convert to upgrades vs stay rented forever is the signal on
// the tier price gap, so nudge impressions and clicks ride along.

import { PROJECT_PASS_CATALOG, type PassAppSlug } from "@/data/project-passes";
import { METERED_FEATURE_SLUGS } from "./credits";

const WINDOW_DAYS = 90;

type ServiceEnv = { url: string; key: string };

function serviceEnv(): ServiceEnv | null {
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

async function fetchRows<T>(env: ServiceEnv, pathAndQuery: string): Promise<T[]> {
  try {
    const res = await fetch(`${env.url}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[metering/admin] read failed", { path: pathAndQuery.split("?")[0], status: res.status });
      return [];
    }
    return (await res.json()) as T[];
  } catch (e) {
    console.warn("[metering/admin] read failed (network)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

export type PassLeaderboardRow = {
  appSlug: PassAppSlug;
  label: string;
  rentals: number;
  uniqueRenters: number;
  revenueCents: number;
  /** Renters with 2+ rentals of this App in the window — the nudged cohort. */
  repeatRenters: number;
};

export type PassAdminReport = {
  windowDays: number;
  leaderboard: PassLeaderboardRow[];
  topUps: { purchases: number; creditsSold: number; revenueCents: number };
  usage: { tierMicroCents: number; rentedMicroCents: number; topUpMicroCents: number };
  nudge: { impressions: number; clicks: number };
};

export async function buildPassAdminReport(): Promise<PassAdminReport | null> {
  const env = serviceEnv();
  if (!env) return null;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [passRows, topUpRows, usageRows, nudgeRows] = await Promise.all([
    fetchRows<{ owner_id: string; app_slug: string; price_paid_cents_at_purchase: number }>(
      env,
      `pa_project_passes?granted_at=gte.${encodeURIComponent(since)}` +
        `&select=owner_id,app_slug,price_paid_cents_at_purchase&limit=10000`,
    ),
    fetchRows<{ credits_added: number; amount_paid_cents: number }>(
      env,
      `pa_top_up_purchases?purchased_at=gte.${encodeURIComponent(since)}` +
        `&select=credits_added,amount_paid_cents&limit=10000`,
    ),
    fetchRows<{ cost_micro_cents: number; entitlement_source: string }>(
      env,
      `pa_cost_events?created_at=gte.${encodeURIComponent(since)}` +
        `&feature_slug=in.(${METERED_FEATURE_SLUGS.join(",")})` +
        `&select=cost_micro_cents,entitlement_source&limit=10000`,
    ),
    fetchRows<{ metadata: { action?: string } }>(
      env,
      `pa_cost_events?created_at=gte.${encodeURIComponent(since)}` +
        `&feature_slug=eq.project_pass_nudge&select=metadata&limit=10000`,
    ),
  ]);

  const leaderboard: PassLeaderboardRow[] = PROJECT_PASS_CATALOG.map((def) => {
    const rows = passRows.filter((r) => r.app_slug === def.appSlug);
    const byOwner = new Map<string, number>();
    for (const r of rows) byOwner.set(r.owner_id, (byOwner.get(r.owner_id) ?? 0) + 1);
    return {
      appSlug: def.appSlug,
      label: def.label,
      rentals: rows.length,
      uniqueRenters: byOwner.size,
      revenueCents: rows.reduce((sum, r) => sum + (r.price_paid_cents_at_purchase ?? 0), 0),
      repeatRenters: [...byOwner.values()].filter((n) => n >= 2).length,
    };
  }).sort((a, b) => b.rentals - a.rentals);

  const usage = { tierMicroCents: 0, rentedMicroCents: 0, topUpMicroCents: 0 };
  for (const r of usageRows) {
    if (r.entitlement_source === "project_pass") usage.rentedMicroCents += r.cost_micro_cents ?? 0;
    else if (r.entitlement_source === "top_up") usage.topUpMicroCents += r.cost_micro_cents ?? 0;
    else usage.tierMicroCents += r.cost_micro_cents ?? 0;
  }

  const nudge = { impressions: 0, clicks: 0 };
  for (const r of nudgeRows) {
    if (r.metadata?.action === "click") nudge.clicks += 1;
    else nudge.impressions += 1;
  }

  return {
    windowDays: WINDOW_DAYS,
    leaderboard,
    topUps: {
      purchases: topUpRows.length,
      creditsSold: topUpRows.reduce((sum, r) => sum + (r.credits_added ?? 0), 0),
      revenueCents: topUpRows.reduce((sum, r) => sum + (r.amount_paid_cents ?? 0), 0),
    },
    usage,
    nudge,
  };
}
