"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Delivery = "inbox" | "email_digest";

export type RitualRunRow = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "failed";
  errorText: string | null;
  costMicroCents: number;
};

type RitualSummary = {
  id: string;
  name: string;
  appLabel: string;
  scheduleText: string;
  delivery: Delivery;
  enabled: boolean;
  nextRunAt: string;
  lastRunStatus: "success" | "failed" | null;
  consecutiveFailures: number;
};

function formatRun(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLE: Record<RitualRunRow["status"], string> = {
  running: "border-slate-700 text-slate-400",
  success: "border-emerald-800 text-emerald-400",
  failed: "border-rose-800 text-rose-400",
};

export default function RitualDetailClient({
  ritual,
  runs,
  totalMicroCents,
}: {
  ritual: RitualSummary;
  runs: RitualRunRow[];
  totalMicroCents: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function runNow() {
    setBusy("run");
    setNote(null);
    const res = await fetch(`/api/app/rituals/${ritual.id}/run-now`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      setNote("Couldn't run it.");
      return;
    }
    setNote("Ran it — the result is in Mission Control.");
    router.refresh();
  }

  async function togglePause() {
    setBusy("pause");
    await fetch(`/api/app/rituals/${ritual.id}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ritual.enabled }),
    });
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    setBusy("delete");
    await fetch(`/api/app/rituals/${ritual.id}`, { method: "DELETE" });
    router.push("/app/apps/rituals");
  }

  // The scheduling overhead is free; the App a ritual fires bills under its own tag. So this rolls up
  // only what ran through the ritual itself — usually $0.00 until per-App headless runs land.
  const dollars = (totalMicroCents / 1_000_000).toFixed(2);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/app/apps/rituals" className="text-xs text-slate-500 hover:text-[#22d3ee]">
          ← All rituals
        </Link>

        <div className="mt-4 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">{ritual.name}</h1>
            {!ritual.enabled && (
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-500">
                Paused
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Runs {ritual.appLabel} · {ritual.scheduleText} ·{" "}
            {ritual.delivery === "email_digest" ? "emails you" : "card in Mission Control"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ritual.enabled ? `Next ${formatRun(ritual.nextRunAt)}` : "Paused — resume to schedule the next run"}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={runNow}
            disabled={busy !== null}
            className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
          >
            {busy === "run" ? "Running…" : "Run now"}
          </button>
          <button
            onClick={togglePause}
            disabled={busy !== null}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
          >
            {ritual.enabled ? "Pause" : "Resume"}
          </button>
          <button
            onClick={remove}
            disabled={busy !== null}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-400 disabled:opacity-40"
          >
            Delete
          </button>
        </div>

        {note && <p className="mb-4 text-xs text-[#22d3ee]">{note}</p>}

        <div className="mb-6 rounded-xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
          <p className="text-xs text-slate-400">
            Run cost through this ritual: <span className="text-slate-100">${dollars}</span>. The App a
            ritual fires bills under its own line in your usage.
          </p>
        </div>

        <h2 className="text-sm font-semibold text-slate-100">Run history</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No runs yet. Tap <span className="text-slate-300">Run now</span> to fire it once, or wait for
            its next scheduled slot.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">{formatRun(run.startedAt)}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase ${STATUS_STYLE[run.status]}`}
                  >
                    {run.status}
                  </span>
                </div>
                {run.errorText && <p className="mt-1.5 text-xs text-rose-400">{run.errorText}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
