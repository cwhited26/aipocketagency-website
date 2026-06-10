import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { redirect } from "next/navigation";
import { listActiveSprints, type SetupSprint } from "@/lib/setup-sprint/sprints";
import { callDurationMinutes } from "@/lib/setup-sprint/calendar-invite-template";
import { isOperatorEmail } from "@/lib/operator";
import { LAUNCH_KIT_SECTIONS } from "@/lib/launch-kit/steps";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminSetupSprintsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) redirect("/app/onboarding");
  if (!isOperatorEmail(user.email)) redirect("/app");

  const sprintsResult = await listActiveSprints();
  const sprints = sprintsResult.ok ? sprintsResult.data : [];

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-2">
            Operator
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Active Setup Sprints</h1>
          <p className="text-slate-400 text-sm mt-2">
            {sprints.length} {sprints.length === 1 ? "sprint" : "sprints"} not yet completed.
          </p>
        </div>

        {sprints.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-center">
            <p className="text-sm text-slate-400">No active Setup Sprints right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {sprints.map((sprint) => (
              <SprintRow key={sprint.id} sprint={sprint} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SprintRow({ sprint }: { sprint: SetupSprint }) {
  const intakeDone = sprint.intake_submitted_at !== null;
  const intake = sprint.intake;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{sprint.email ?? "(no email)"}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {sprint.tier === "premium" ? "Premium" : "Standard"} ·{" "}
            {callDurationMinutes(sprint.tier)} min · step: {sprint.current_step}
          </p>
        </div>
        <span
          className={`shrink-0 text-[11px] font-mono rounded px-2 py-0.5 border ${
            intakeDone
              ? "border-[#22d3ee]/40 text-[#22d3ee]"
              : "border-amber-500/40 text-amber-300"
          }`}
        >
          intake: {intakeDone ? "yes" : "no"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
        <div>
          <span className="font-mono uppercase tracking-wider text-slate-600 text-[10px]">
            Created
          </span>
          <p className="text-slate-300 mt-0.5">{formatDate(sprint.created_at)}</p>
        </div>
        <div>
          <span className="font-mono uppercase tracking-wider text-slate-600 text-[10px]">
            Intake at
          </span>
          <p className="text-slate-300 mt-0.5">{formatDate(sprint.intake_submitted_at)}</p>
        </div>
        <div>
          <span className="font-mono uppercase tracking-wider text-slate-600 text-[10px]">
            Call at
          </span>
          <p className="text-slate-300 mt-0.5">{formatDate(sprint.call_scheduled_at)}</p>
        </div>
      </div>

      {intakeDone && (
        <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-950/50 p-4 flex flex-col gap-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Intake responses
          </p>
          <IntakeField label="Business name" value={intake.business_name} />
          <IntakeField label="What they sell" value={intake.offerings} />
          <IntakeField label="Who they work with" value={intake.target_customer} />
          <IntakeField label="What eats their time" value={intake.current_admin_pain} />
          <div>
            <span className="text-[11px] font-medium text-slate-400">Top workflows</span>
            {intake.top_workflows && intake.top_workflows.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1">
                {intake.top_workflows.map((w, i) => (
                  <li key={i} className="text-[13px] text-slate-300 flex gap-2">
                    <span className="text-[#22d3ee]/50">·</span>
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-slate-600 mt-0.5">—</p>
            )}
          </div>
        </div>
      )}

      {/* Operator implementation checklist — what to install for this owner. Reference only. */}
      <div className="mt-4">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
          Implementation checklist
        </p>
        <div className="flex flex-col gap-3">
          {LAUNCH_KIT_SECTIONS.map((section) => (
            <div key={section.key}>
              <p className="text-[12px] font-semibold text-slate-300">{section.title}</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {section.steps.map((step) => (
                  <li key={step.slug} className="text-[12px] text-slate-500 flex gap-2">
                    <span className="text-slate-700" aria-hidden>
                      ▢
                    </span>
                    {step.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntakeField({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      <p className="text-[13px] text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">
        {value && value.trim().length > 0 ? value : "—"}
      </p>
    </div>
  );
}
