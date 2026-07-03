import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentTier, tierAllowsSignalCatcher } from "@/lib/personas/tier-caps";
import { listSignalCatches } from "@/lib/signal-catcher/db";
import type { SignalCatch, SignalCatchStatus } from "@/lib/signal-catcher/types";

// /app/apps/signal-catcher — the owner-visible catch history (PA-SIGNAL-1): every signal PA
// noticed, what it proposed, and how the owner settled it. Server-rendered read-only list; the
// decisions themselves happen on the Mission Control cards.

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<SignalCatchStatus, { label: string; tone: string }> = {
  pending_review: { label: "Waiting on you", tone: "text-amber-300/80 border-amber-500/30" },
  approved: { label: "Ritual created", tone: "text-[#22d3ee] border-[#22d3ee]/30" },
  rejected: { label: "You passed", tone: "text-slate-400 border-slate-600/50" },
  deduped_already_ritualized: {
    label: "Already a ritual",
    tone: "text-slate-400 border-slate-600/50",
  },
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CatchRow({ item }: { item: SignalCatch }) {
  const status = STATUS_LABELS[item.status];
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{item.suggested_ritual_name}</p>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${status.tone}`}
        >
          {status.label}
        </span>
      </div>
      <blockquote className="mt-2 border-l-2 border-slate-700 pl-3 text-sm italic leading-relaxed text-slate-400">
        &ldquo;{item.quote.length > 240 ? `${item.quote.slice(0, 240)}…` : item.quote}&rdquo;
      </blockquote>
      <p className="mt-2 font-mono text-[11px] text-slate-500">
        {item.suggested_cadence} · caught {formatDay(item.created_at)}
      </p>
    </div>
  );
}

export default async function SignalCatcherPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const [catchesRes, tier] = await Promise.all([
    listSignalCatches(user.id),
    getCurrentTier(user.id),
  ]);
  const catches = catchesRes.ok ? catchesRes.data : [];
  const tierAllows = tierAllowsSignalCatcher(tier);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]/60">
            Listens, then asks
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Signal Catcher</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Mention a wish in chat and PA proposes it as a ritual — your exact words on the card,
            your call on whether it runs. This is everything it has caught so far.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {catches.length === 0
              ? "Nothing caught yet."
              : `${catches.length} ${catches.length === 1 ? "catch" : "catches"} so far.`}
          </p>
          <Link
            href="/app/settings/signal-catcher"
            className="text-xs text-slate-400 hover:text-[#22d3ee]"
          >
            Settings →
          </Link>
        </div>

        {!tierAllows && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
            <span className="mt-0.5 shrink-0 font-mono text-sm text-[#22d3ee]">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Signal Catcher runs on the AI Agent Workspace plan and up.
              </p>
              <p className="mt-1 text-sm text-slate-300">
                <Link href="/app/settings/tier" className="text-[#22d3ee] hover:underline">
                  See your plan →
                </Link>
              </p>
            </div>
          </div>
        )}

        {catches.length > 0 ? (
          <div className="flex flex-col gap-3">
            {catches.map((c) => (
              <CatchRow key={c.id} item={c} />
            ))}
          </div>
        ) : (
          tierAllows && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-6">
              <p className="text-sm leading-relaxed text-slate-400">
                Talk to your Personas the way you already do. The first time you mention something
                you keep meaning to set up — a Monday pipeline review, a Friday lead digest — the
                proposal shows up in{" "}
                <Link href="/app/mission-control" className="text-slate-300 hover:text-[#22d3ee]">
                  Mission Control
                </Link>
                .
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
