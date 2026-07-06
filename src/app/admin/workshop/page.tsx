// /admin/workshop — the operator's workshop funnel view (PA-POS-38). Registrations, attendance
// rate, the conversion funnel (workshop → trial → active month 1 → Studio+ upgrade), OTO take
// rates, and the real attendee chat log Chase reviews after sessions. Operator-only
// (isOperatorEmail), same gate as /admin/passes.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import { isOperatorEmail } from "@/lib/operator";
import { buildWorkshopAdminReport } from "@/lib/workshop/db";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default async function AdminWorkshopPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  if (!isOperatorEmail(user.email)) redirect("/app");

  const report = await buildWorkshopAdminReport();

  const stats: Array<{ label: string; value: string; detail: string }> = [
    {
      label: "Registrations",
      value: String(report.registrations),
      detail: `${report.bumps} took the +$27 bump (${pct(report.bumps, report.registrations)})`,
    },
    {
      label: "Attendance",
      value: pct(report.attended, report.registrations),
      detail: `${report.attended} attended · ${report.noShows} no-shows`,
    },
    {
      label: "OTO 1 — Setup Sprint",
      value: pct(report.oto1Taken, report.oto1Offered),
      detail: `${report.oto1Taken} of ${report.oto1Offered} decisions`,
    },
    {
      label: "OTO 2 — Backstage Pass",
      value: pct(report.oto2Taken, report.oto2Offered),
      detail: `${report.oto2Taken} of ${report.oto2Offered} decisions · ${report.backstagePasses} active passes`,
    },
    {
      label: "Workshop trials",
      value: String(report.workshopTrials),
      detail: `${report.workshopTrialsActive} paying after month 1 (${pct(report.workshopTrialsActive, report.workshopTrials)})`,
    },
    {
      label: "Studio+ upgrades",
      value: String(report.workshopStudioUpgrades),
      detail: `${pct(report.workshopStudioUpgrades, report.workshopTrials)} of workshop trials`,
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Operator
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Business Brain Workshop</h1>
          <p className="text-slate-400 text-sm mt-2">
            The evergreen funnel end to end: seats sold, who showed, what the OTO stack took, and
            how the 30-day trials convert. The chat log below is every real attendee message —
            answer the good ones in Friday&rsquo;s Implementation Lab.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-100">{s.value}</p>
              <p className="mt-1 text-sm text-slate-400">{s.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-100">Attendee chat log</h2>
          <p className="mt-1 text-sm text-slate-400">
            Last 100 messages, newest first. These never surfaced in the live feed.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800/60 bg-slate-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {report.recentChat.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No attendee messages yet.
                    </td>
                  </tr>
                ) : (
                  report.recentChat.map((m) => (
                    <tr key={`${m.registration_id}-${m.created_at}`} className="border-b border-slate-800/50 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                        {new Date(m.created_at).toLocaleString("en-US")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{m.sender_name}</td>
                      <td className="px-4 py-3 text-slate-200">{m.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
