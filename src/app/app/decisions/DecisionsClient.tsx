"use client";

// DecisionsClient — the roundtable history list (PA-DR §9). Search across question text, see each
// verdict's status + backings at a glance, and expand a row to read the full transcript (fetched lazily)
// and the saved brain link.

import { useMemo, useState } from "react";
import { ROLE_LABELS, type Roundtable, type RoundtableTurn, type Verdict } from "@/lib/decisions/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  running: { label: "Running", color: "#22d3ee" },
  verdict_ready: { label: "Verdict ready", color: "#34d399" },
  saved: { label: "Saved", color: "#34d399" },
  rejected: { label: "Rejected", color: "#f59e0b" },
  cancelled: { label: "Closed", color: "#64748b" },
};

function Row({ rt }: { rt: Roundtable }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<RoundtableTurn[] | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const style = STATUS_STYLE[rt.status] ?? STATUS_STYLE.cancelled;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && turns === null && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/app/decisions/${rt.id}`);
        if (res.ok) {
          const data = (await res.json()) as { turns: RoundtableTurn[]; verdict: Verdict | null };
          setTurns(data.turns);
          setVerdict(data.verdict);
        } else {
          setTurns([]);
        }
      } catch {
        setTurns([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">
      <button onClick={toggle} className="w-full text-left px-4 py-3.5 hover:bg-slate-900 transition-colors">
        <div className="flex items-start gap-3">
          <span className="text-[#34d399]/60 shrink-0 mt-0.5 text-sm">⚖</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-200 line-clamp-1">{rt.question}</p>
            {rt.verdict && <p className="text-[13px] text-slate-400 mt-0.5 line-clamp-1">{rt.verdict}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ color: style.color, background: `${style.color}1a`, border: `1px solid ${style.color}33` }}
              >
                {style.label}
              </span>
              <span className="text-[10px] font-mono text-slate-600">{rt.decision_type}</span>
              <span className="text-[10px] font-mono text-slate-600">{relativeTime(rt.started_at)}</span>
            </div>
          </div>
          <span className="text-slate-600 text-xs shrink-0 mt-1">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-3">
          {loading ? (
            <p className="text-[12px] text-slate-500 py-2">Loading transcript…</p>
          ) : (
            <>
              {rt.model_backings.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rt.model_backings.map((b) => (
                    <span key={b} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-400">
                      {b}
                    </span>
                  ))}
                </div>
              )}
              {verdict && (
                <div className="space-y-2">
                  {verdict.strongestDissent && (
                    <div>
                      <p className="text-[10px] font-mono tracking-[0.1em] uppercase text-amber-400/70 mb-0.5">Strongest dissent</p>
                      <p className="text-[13px] text-slate-400 leading-relaxed">{verdict.strongestDissent}</p>
                    </div>
                  )}
                  {verdict.supportingEvidence && (
                    <div>
                      <p className="text-[10px] font-mono tracking-[0.1em] uppercase text-slate-500 mb-0.5">Supporting evidence</p>
                      <p className="text-[13px] text-slate-400 leading-relaxed">{verdict.supportingEvidence}</p>
                    </div>
                  )}
                </div>
              )}
              {rt.rejection_reason && (
                <p className="text-[12px] text-amber-300/70">Rejected: {rt.rejection_reason}</p>
              )}
              {turns && turns.length > 0 && (
                <div className="space-y-2 pt-1">
                  {turns.map((t) => (
                    <div key={t.id}>
                      <p className="text-[10px] font-mono tracking-[0.1em] uppercase text-slate-500">
                        {ROLE_LABELS[t.role]}
                        {t.role !== "owner_interjection" && t.role !== "moderator" ? ` · round ${t.round_index + 1}` : ""}
                      </p>
                      <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{t.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {rt.verdict_brain_path && (
                <p className="text-[11px] font-mono text-slate-500">Saved to brain: {rt.verdict_brain_path}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DecisionsClient({
  roundtables,
  eligible,
  monthlyCap,
}: {
  roundtables: Roundtable[];
  eligible: boolean;
  monthlyCap: number;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roundtables;
    return roundtables.filter((r) => r.question.toLowerCase().includes(q) || (r.verdict ?? "").toLowerCase().includes(q));
  }, [query, roundtables]);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-6">
        <div>
          <div className="text-[11px] text-[#34d399]/60 font-mono tracking-[0.18em] uppercase mb-1">
            For the calls that matter
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Decisions</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            When you ask your agent a real judgment call, it can put three of its agents on it — one arguing
            for, one against, a moderator who weighs them — and bring you a verdict you edit before it saves.
            Every roundtable you&apos;ve run lands here as a record you can revisit.
          </p>
          {eligible ? (
            <p className="text-[12px] text-slate-500 mt-2">
              Start one from the Ask box — type a decision question and PA will offer to run a roundtable. Your
              plan includes {monthlyCap} a month.
            </p>
          ) : (
            <p className="text-[12px] text-slate-500 mt-2">
              Decision Roundtable runs the multi-agent debate on Studio+.{" "}
              <a href="/app/settings" className="text-[#34d399]/80 hover:underline">See plans →</a>
            </p>
          )}
        </div>

        {roundtables.length > 0 && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your decisions…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#34d399]/40 focus:outline-none"
          />
        )}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-5 py-8 text-center">
            <p className="text-sm text-slate-300">
              {roundtables.length === 0 ? "No decisions yet." : "Nothing matches that search."}
            </p>
            {roundtables.length === 0 && (
              <p className="text-[13px] text-slate-500 mt-1">
                Ask your agent a real call — &quot;should I raise prices on this client?&quot; — and run a
                roundtable on it. The verdict shows up here.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((rt) => (
              <Row key={rt.id} rt={rt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
