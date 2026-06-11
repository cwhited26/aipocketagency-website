"use client";

import { useEffect, useState } from "react";
import { ROUTINE_DEFS, ROUTINE_KINDS } from "@/lib/routine-meta";
import type { RoutineKind } from "@/lib/routine-meta";
import Mascot from "@/components/Mascot";
import Link from "next/link";
import { TabGuide } from "../_components/TabGuide";

type Routine = {
  id: string;
  kind: RoutineKind;
  enabled: boolean;
  schedule_cron: string;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
};

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

function formatLastRun(lastRunAt: string | null, lastError: string | null): string {
  if (!lastRunAt) return "Never run";
  const when = new Date(lastRunAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return lastError ? `${when} · failed` : `${when} · delivered`;
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  busy,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={busy}
      aria-label={enabled ? "Disable routine" : "Enable routine"}
      className="relative flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`relative inline-block h-6 w-11 rounded-full transition-colors duration-200 ${
          enabled
            ? "bg-[#22d3ee]/15 border border-[#22d3ee]/50"
            : "bg-slate-800 border border-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow transition-transform duration-200 ${
            enabled ? "translate-x-5 bg-[#22d3ee]" : "translate-x-0 bg-slate-600"
          }`}
        />
      </span>
    </button>
  );
}

// ─── Routine card ──────────────────────────────────────────────────────────────

function RoutineCard({
  routine,
  onToggle,
}: {
  routine: Routine;
  onToggle: (kind: RoutineKind, enabled: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(routine.enabled);
  const [localNextRun, setLocalNextRun] = useState(routine.next_run_at);
  const [toggleErr, setToggleErr] = useState<string | null>(null);
  const def = ROUTINE_DEFS[routine.kind];

  useEffect(() => {
    setLocalEnabled(routine.enabled);
    setLocalNextRun(routine.next_run_at);
  }, [routine.enabled, routine.next_run_at]);

  async function handleToggle(enabled: boolean) {
    setBusy(true);
    setToggleErr(null);
    try {
      await onToggle(routine.kind, enabled);
      setLocalEnabled(enabled);
    } catch (e) {
      setToggleErr(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setBusy(false);
    }
  }

  const hasRunError = Boolean(routine.last_error);

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
        localEnabled
          ? "border-slate-700/60 bg-slate-900/70"
          : "border-slate-800/40 bg-slate-900/30 opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold leading-snug ${
              localEnabled ? "text-slate-100" : "text-slate-400"
            }`}
          >
            {def.label}
          </p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{def.description}</p>
        </div>
        <Toggle enabled={localEnabled} onChange={(v) => void handleToggle(v)} busy={busy} />
      </div>

      {toggleErr && (
        <p className="text-[11px] font-mono text-red-400">{toggleErr}</p>
      )}

      <div className="flex flex-col gap-1 pt-2 border-t border-slate-800/40">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.14em]">
            Next run
          </span>
          <span className="text-[11px] font-mono text-slate-400 text-right">
            {localEnabled ? formatDate(localNextRun) : "Disabled"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.14em]">
            Last run
          </span>
          <span
            className={`text-[11px] font-mono text-right ${
              hasRunError
                ? "text-red-400"
                : routine.last_run_at
                ? "text-slate-400"
                : "text-slate-600"
            }`}
          >
            {formatLastRun(routine.last_run_at, routine.last_error)}
          </span>
        </div>
      </div>

      {routine.last_error && (
        <div className="rounded-lg bg-red-950/30 border border-red-900/30 px-3 py-2">
          <p className="text-[11px] font-mono text-red-400 leading-relaxed">{routine.last_error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

// The Daily-Brief plug-in: fold the owner's last-24h YouTube ingests (with each video's use-case
// bucket) into the brief. Self-contained — reads + writes its own pref via /api/app/youtube/brief-toggle.
function YouTubeBriefToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/app/youtube/brief-toggle", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ enabled?: boolean }>) : Promise.reject()))
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => {
        // Pref read failed — leave the toggle off; the owner can still flip it.
      });
  }, []);

  async function handleChange(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/app/youtube/brief-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
        cache: "no-store",
      });
      if (res.ok) setEnabled(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">Include YouTube ingests from the last 24h</p>
        <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
          When on, your Daily Brief lists the videos you shared and what bucket each landed in.
        </p>
      </div>
      <Toggle enabled={enabled} onChange={(v) => void handleChange(v)} busy={busy} />
    </div>
  );
}

export default function RoutinesClient() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/app/routines", { cache: "no-store" })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ routines: Routine[] }>)
          : r
              .json()
              .then((b: { error?: string }) =>
                Promise.reject(new Error(b.error ?? String(r.status))),
              ),
      )
      .then((d) => {
        const order: RoutineKind[] = [...ROUTINE_KINDS];
        const sorted = [...d.routines].sort(
          (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
        );
        setRoutines(sorted);
      })
      .catch((e: unknown) =>
        setFetchErr(e instanceof Error ? e.message : "Failed to load routines"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(kind: RoutineKind, enabled: boolean) {
    const res = await fetch(`/api/app/routines/${kind}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
      cache: "no-store",
    });
    const body = (await res.json()) as {
      error?: string;
      kind?: string;
      enabled?: boolean;
      next_run_at?: string | null;
    };
    if (!res.ok) throw new Error(body.error ?? "Toggle failed");
    setRoutines((prev) =>
      prev.map((r) =>
        r.kind !== kind
          ? r
          : { ...r, enabled: body.enabled ?? enabled, next_run_at: body.next_run_at ?? null },
      ),
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-6">

        <div>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mb-1">
            Automated agent tasks
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Routines</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Work your agent does on a schedule, without you asking.
          </p>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Some work happens on a clock, not a request. A Daily Brief every weekday morning so you
          start with what&apos;s on the radar. A follow-up sweep every Sunday night so nothing goes
          cold. A weekly read on what moved and what stalled. Flip a routine on and your agent runs
          it on its own, pulls from your brain, and drops the result in your{" "}
          <Link href="/app/mission-control" className="text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors">
            Inbox
          </Link>{" "}
          for you to read. The fresher your brain, the better each run. (Soon you&apos;ll be able to
          run separate routines for separate businesses, each off its own brain.)
        </p>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 flex items-start gap-3">
          <span className="text-[#22d3ee]/40 shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4v3.5L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-xs text-slate-500 leading-relaxed">
            All times UTC. Daily Brief at{" "}
            <span className="text-slate-400 font-mono">8:00 AM</span>. Follow-up Sweep at{" "}
            <span className="text-slate-400 font-mono">Mon 9:00 AM</span>. Weekly Digest at{" "}
            <span className="text-slate-400 font-mono">Mon 7:00 AM</span>.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Mascot state="working" size={80} />
            <p className="text-[12px] font-mono text-slate-500">loading routines…</p>
          </div>
        ) : fetchErr ? (
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-5 py-5 flex flex-col items-center gap-3 text-center">
            <Mascot state="empty" size={64} />
            <p className="text-sm text-slate-200 font-semibold">Routines configuration error</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Refreshing the page should fix it. If it persists,{" "}
              <a
                href="mailto:support@aipocketagent.com"
                className="text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
              >
                contact support
              </a>
              .
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 min-h-[44px] px-5 rounded-lg border border-slate-700 bg-slate-900/70 text-sm text-slate-200 hover:border-[#22d3ee]/50 transition-colors"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {routines.map((r) => (
              <RoutineCard key={r.id} routine={r} onToggle={handleToggle} />
            ))}
            {/* Daily-Brief plug-in — only relevant once the Daily Brief routine is on. */}
            {routines.some((r) => r.kind === "daily_brief" && r.enabled) && <YouTubeBriefToggle />}
          </div>
        )}

        {/* First-touch guide — what to ask, what this connects to, and a sample brief */}
        <TabGuide
          promptsHeading="Try one of these"
          prompts={[
            "Run a Daily Brief every weekday at 8am",
            "Sweep my follow-ups every Sunday night",
            "Send me a weekly read on what moved and what stalled",
          ]}
          worksWith={[
            {
              href: "/app/mission-control",
              label: "Mission Control",
              blurb: "Whatever a routine produces lands there for you to read and clear.",
            },
            {
              href: "/app/email",
              label: "Email",
              blurb: "Some routines email you directly — like your Daily Brief landing in your inbox.",
            },
            {
              href: "/app/calendar",
              label: "Calendar",
              blurb: "A routine can prep you before meetings by pulling the day off your calendar.",
            },
          ]}
          exampleLabel="See an example Daily Brief"
          exampleNote="This is a sample. Turn a routine on above and its real output lands in Mission Control."
        >
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
            <div className="text-[10px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.18em]">
              Daily Brief · Mon 8:00 AM
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-100">Here&apos;s what&apos;s on the radar</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-slate-400">
              <li className="leading-relaxed">
                <span className="text-slate-200">Move on today:</span> the Delgado rebuild decision is
                expected this week — your follow-up draft is in the Inbox.
              </li>
              <li className="leading-relaxed">
                <span className="text-slate-200">Pending your approval:</span> 2 drafted replies, 1
                calendar invite.
              </li>
              <li className="leading-relaxed">
                <span className="text-slate-200">Going quiet:</span> the Carter kitchen remodel — quote
                sent 12 days ago, no reply.
              </li>
            </ul>
          </div>
        </TabGuide>

      </div>
    </div>
  );
}
