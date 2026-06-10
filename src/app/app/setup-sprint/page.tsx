import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fetchSprintForOwner, type SetupSprint } from "@/lib/setup-sprint/sprints";
import { callDurationMinutes, bookingLink } from "@/lib/setup-sprint/calendar-invite-template";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

type TimelineStep = { label: string; done: boolean; active: boolean };

function buildTimeline(sprint: SetupSprint): TimelineStep[] {
  const intakeDone = sprint.intake_submitted_at !== null;
  const callDone = sprint.call_scheduled_at !== null;
  const buildingDone = sprint.completed_at !== null;
  const isBuilding = sprint.current_step === "building" || (callDone && !buildingDone);

  return [
    { label: "Awaiting intake", done: intakeDone, active: !intakeDone },
    { label: "Intake submitted", done: intakeDone, active: intakeDone && !callDone },
    { label: "Call scheduled", done: callDone, active: callDone && !isBuilding && !buildingDone },
    { label: "Building your office", done: buildingDone, active: isBuilding && !buildingDone },
    { label: "Done", done: buildingDone, active: false },
  ];
}

export default async function SetupSprintPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");

  const sprintResult = await fetchSprintForOwner(user.id);
  const sprint = sprintResult.ok ? sprintResult.data : null;

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Done-With-You Setup
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Setup Sprint</h1>
        </div>

        {!sprint ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-slate-100">No Setup Sprint on your account</p>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md mx-auto">
              The Done-With-You Setup is where we build your AI Office together — your Business
              Brain, your Personas, and your first workflow running, on a call with you.
            </p>
            <Link
              href="/upsell"
              className="inline-flex items-center justify-center mt-5 min-h-[44px] px-5 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors"
            >
              See the Done-With-You Setup
            </Link>
          </div>
        ) : (
          <SprintDetail sprint={sprint} />
        )}
      </div>
    </div>
  );
}

function SprintDetail({ sprint }: { sprint: SetupSprint }) {
  const tierLabel = sprint.tier === "premium" ? "Premium" : "Standard";
  const timeline = buildTimeline(sprint);
  const intakeDone = sprint.intake_submitted_at !== null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-slate-300 text-sm leading-relaxed">
        Here is where your setup stands. Fill the short intake before the call so we spend the time
        building, then book your Implementation Call.
      </p>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Your plan
          </span>
          <span className="text-sm font-semibold text-slate-100">{tierLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Call length
          </span>
          <span className="text-sm text-slate-300">{callDurationMinutes(sprint.tier)} min</span>
        </div>
        {sprint.call_scheduled_at && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Call time
            </span>
            <span className="text-sm text-slate-300 text-right">
              {formatDate(sprint.call_scheduled_at)}
            </span>
          </div>
        )}
      </div>

      {/* Status timeline */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-3">Status</p>
        <ol className="flex flex-col gap-2.5">
          {timeline.map((step) => (
            <li key={step.label} className="flex items-center gap-3">
              <span
                className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[11px] border ${
                  step.done
                    ? "bg-[#22d3ee]/15 border-[#22d3ee]/60 text-[#22d3ee]"
                    : step.active
                      ? "border-[#22d3ee]/60 text-[#22d3ee]"
                      : "border-slate-700 text-slate-600"
                }`}
                aria-hidden
              >
                {step.done ? "✓" : "•"}
              </span>
              <span
                className={`text-sm ${
                  step.done
                    ? "text-slate-400"
                    : step.active
                      ? "text-slate-100 font-medium"
                      : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {intakeDone ? (
          <div className="flex-1 rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-4 py-3 flex items-center gap-2">
            <span className="text-[#22d3ee]" aria-hidden>
              ▣
            </span>
            <span className="text-sm text-slate-200">Intake submitted</span>
          </div>
        ) : (
          <Link
            href="/app/setup-sprint/intake"
            className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors"
          >
            Fill your intake
          </Link>
        )}
        <a
          href={bookingLink()}
          target="_blank"
          rel="noreferrer"
          className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-xl border border-[#22d3ee]/30 text-[#22d3ee] text-sm font-semibold hover:bg-[#22d3ee]/5 transition-colors"
        >
          Book your call
        </a>
      </div>
    </div>
  );
}
