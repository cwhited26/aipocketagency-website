import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fetchSprintForOwner } from "@/lib/setup-sprint/sprints";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

export default async function SetupSprintIntakePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const sprintResult = await fetchSprintForOwner(user.id);
  const sprint = sprintResult.ok ? sprintResult.data : null;
  if (!sprint) redirect("/app/setup-sprint");

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/setup-sprint"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Setup Sprint
          </Link>
        </div>

        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Before your call
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Setup Sprint intake</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            A few questions so we walk into the call already knowing your business. Fill what you
            can — we cover the rest together.
          </p>
        </div>

        <IntakeForm defaults={sprint.intake} />
      </div>
    </div>
  );
}
