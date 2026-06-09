import { createClient } from "@/lib/supabase/server";
import { getBudgetSummary, type BudgetSummary } from "@/lib/cost/budget";
import { redirect } from "next/navigation";
import BudgetClient from "./BudgetClient";

export const dynamic = "force-dynamic";

export default async function BudgetSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  let summary: BudgetSummary | null = null;
  let loadError: string | null = null;
  try {
    summary = await getBudgetSummary(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Couldn't load your budget.";
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
          <h1 className="text-2xl font-bold text-slate-100">Monthly cost budget</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            A spending cap on what your agents cost in metered work — transcribing podcasts, scouting
            leads, running builds. When you near it, your agent checks in before spending more. Your chat
            always keeps working.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
            <p className="text-sm font-semibold text-amber-200">Couldn&apos;t load your budget</p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{loadError}</p>
          </div>
        ) : summary ? (
          <BudgetClient initial={summary} />
        ) : null}
      </div>
    </div>
  );
}
