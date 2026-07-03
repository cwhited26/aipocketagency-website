// /admin/passes — the operator's Project Pass leaderboard (PA-POS-31). Which Apps rent, who
// rents twice (the nudged cohort), what the nudge converts, and how metered spend splits between
// tier-included and rented usage. Operator-only (isOperatorEmail), same as /admin/setup-sprints.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import { isOperatorEmail } from "@/lib/operator";
import { buildPassAdminReport } from "@/lib/metering/admin";

export const dynamic = "force-dynamic";

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function microDollars(microCents: number): string {
  return `$${(microCents / 1_000_000).toFixed(2)}`;
}

export default async function AdminPassesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  if (!isOperatorEmail(user.email)) redirect("/app");

  const report = await buildPassAdminReport();

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Operator
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Project Passes</h1>
          <p className="text-slate-400 text-sm mt-2">
            Rentals, repeat renters, and the rented-vs-tier usage split — last{" "}
            {report?.windowDays ?? 90} days. Repeat renters saw the conversion nudge; the
            click count below is how many looked at the tiers.
          </p>
        </div>

        {!report ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-center">
            <p className="text-sm text-slate-400">
              Supabase service credentials aren&rsquo;t set — no report to build.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="overflow-x-auto rounded-2xl border border-slate-800/60 bg-slate-900/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">App</th>
                    <th className="px-4 py-3 text-right">Rentals</th>
                    <th className="px-4 py-3 text-right">Renters</th>
                    <th className="px-4 py-3 text-right">Repeat (2+)</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.leaderboard.map((row) => (
                    <tr key={row.appSlug} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-4 py-3 text-slate-200">{row.label}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{row.rentals}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{row.uniqueRenters}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{row.repeatRenters}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{dollars(row.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Metered spend split
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Tier-included {microDollars(report.usage.tierMicroCents)}
                </p>
                <p className="text-sm text-slate-300">
                  Rented {microDollars(report.usage.rentedMicroCents)}
                </p>
                <p className="text-sm text-slate-300">
                  Top Up {microDollars(report.usage.topUpMicroCents)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Top Ups
                </p>
                <p className="mt-2 text-sm text-slate-300">{report.topUps.purchases} purchases</p>
                <p className="text-sm text-slate-300">
                  {report.topUps.creditsSold.toLocaleString("en-US")} credits sold
                </p>
                <p className="text-sm text-slate-300">{dollars(report.topUps.revenueCents)} revenue</p>
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Conversion nudge
                </p>
                <p className="mt-2 text-sm text-slate-300">{report.nudge.impressions} impressions</p>
                <p className="text-sm text-slate-300">{report.nudge.clicks} clicks to tiers</p>
                <p className="text-sm text-slate-500">
                  Repeat renters who keep renting are a price signal, not a bug.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
