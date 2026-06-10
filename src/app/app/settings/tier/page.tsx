import { createClient } from "@/lib/supabase/server";
import { getUsageSnapshot, type UsageSnapshot, type UsageMetricRow } from "@/lib/usage/snapshot";
import { redirect } from "next/navigation";
import { UsageLimitBanner } from "@/app/app/_components/UsageLimitBanner";
import type { UsageLimitKind } from "@/lib/copy/in-app";

// The three usage caps that have a Part 7V banner. Other metrics (youtube, connections, personas,
// roundtable) fall back to the per-row upgrade CTA below.
const USAGE_BANNER_KIND: Partial<Record<UsageMetricRow["key"], UsageLimitKind>> = {
  lead_scout: "leads",
  podcast_whisper: "whisper",
  sub_agent: "sub_agent_runs",
};

// Settings → Tier & limits (Usage Surface v1, PA-USAGE-5). The reframe of the old Settings → Budget:
// no dollar-cap input anymore. In the platform-managed flow the owner can't "set a budget" — they can
// only upgrade their tier — so this is a read-only view of the current plan, every cap, and an
// Upgrade CTA on each cap that's been hit or is getting close. Server-rendered (no client state).

export const dynamic = "force-dynamic";

const numberFmt = new Intl.NumberFormat("en-US");

function capLabel(row: UsageMetricRow): string {
  if (row.informational) return "No limit";
  if (row.cap === null) return "Unlimited";
  if (row.cap === 0) return "Not on this plan";
  return amount(row.cap, row.unit);
}

function amount(value: number, unit: UsageMetricRow["unit"]): string {
  if (unit === "hours") return `${value % 1 === 0 ? value : value.toFixed(1)} h`;
  if (unit === "minutes") return `${numberFmt.format(value)} min`;
  return `${numberFmt.format(value)} ${unit}`;
}

function statusFor(row: UsageMetricRow): "ok" | "near" | "hit" | "off" | "info" {
  if (row.informational || row.cap === null) return "info";
  if (row.cap === 0) return "off";
  if (row.pct >= 100) return "hit";
  if (row.pct >= 80) return "near";
  return "ok";
}

export default async function TierLimitsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  let snapshot: UsageSnapshot | null = null;
  let loadError: string | null = null;
  try {
    snapshot = await getUsageSnapshot(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Couldn't load your plan.";
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        <div>
          <a
            href="/app/settings"
            className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1 inline-block hover:text-[#22d3ee]"
          >
            ← Settings
          </a>
          <h1 className="text-2xl font-bold text-slate-100">Tier &amp; limits</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Your plan and what&apos;s included each month. Your subscription is flat — we cover the model
            costs behind the scenes, so there&apos;s no spending cap to set here. When you reach a limit,
            you upgrade for more headroom. Your chat always keeps working.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-amber-200">Couldn&apos;t load your plan</p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{loadError}</p>
          </div>
        ) : snapshot ? (
          <>
            {/* Part 7V: a usage-limit banner for every cap the owner has hit. Same message as the
                email confirmation the usage-cap hook enqueues — different channel. */}
            {snapshot.metrics
              .filter((row) => statusFor(row) === "hit" && USAGE_BANNER_KIND[row.key])
              .map((row) => (
                <UsageLimitBanner key={`cap-${row.key}`} kind={USAGE_BANNER_KIND[row.key]!} />
              ))}

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-slate-500 font-mono tracking-[0.14em] uppercase">
                  Current plan
                </p>
                <p className="text-xl font-bold text-slate-100 mt-0.5">{snapshot.tierLabel}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Monthly limits reset{" "}
                  {new Date(snapshot.periodResetAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                  .
                </p>
              </div>
              {snapshot.nextTierLabel && (
                <a
                  href="/api/app/billing-portal"
                  className="shrink-0 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
                >
                  Upgrade to {snapshot.nextTierLabel}
                </a>
              )}
            </div>

            <div className="space-y-3">
              {snapshot.metrics.map((row) => {
                const status = statusFor(row);
                return (
                  <div
                    key={row.key}
                    className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 py-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-slate-200">{row.label}</span>
                      <span className="text-[12px] font-mono text-slate-400 tabular-nums">
                        {capLabel(row)}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{row.blurb}</p>
                    {(status === "near" || status === "hit" || status === "off") &&
                      snapshot.nextTierLabel && (
                        <a
                          href="/api/app/billing-portal"
                          className="mt-2 inline-block text-[12px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
                        >
                          {status === "off"
                            ? `Turn this on with ${snapshot.nextTierLabel} →`
                            : status === "hit"
                              ? `You're out for the month — upgrade to ${snapshot.nextTierLabel} →`
                              : `Getting close — upgrade to ${snapshot.nextTierLabel} →`}
                        </a>
                      )}
                  </div>
                );
              })}
            </div>

            <p className="text-[12px] text-slate-600 leading-relaxed">
              Want the live month-to-date count for each of these? It&apos;s on the Usage tab in{" "}
              <a href="/app/mission-control" className="text-slate-400 underline hover:text-[#22d3ee]">
                Mission Control
              </a>
              .
            </p>

            <div className="border-t border-slate-800/60 pt-4">
              <a
                href="/cancel"
                className="text-[12px] text-slate-600 underline hover:text-slate-400 transition-colors"
              >
                Cancel subscription
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
