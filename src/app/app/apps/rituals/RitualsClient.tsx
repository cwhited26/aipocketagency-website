"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseSchedule, nextRuns } from "@/lib/rituals/parser";

type Delivery = "inbox" | "email_digest";
type RunStatus = "success" | "failed" | null;

export type RitualView = {
  id: string;
  name: string;
  appSlug: string | null;
  scheduleText: string;
  delivery: Delivery;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: RunStatus;
  consecutiveFailures: number;
};

type SeedView = { id: string; name: string; scheduleText: string; description: string };
type AppOption = { id: string; label: string; blurb: string };

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none";
const LABEL_CLASS = "text-[11px] font-mono text-slate-400 uppercase tracking-wider";

// Composed phrases the day/time picker emits — each parses cleanly, so the owner never sees a dead end.
const PICKER_DAYS: { value: string; label: string }[] = [
  { value: "every day", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "every Monday", label: "Mondays" },
  { value: "every Tuesday", label: "Tuesdays" },
  { value: "every Wednesday", label: "Wednesdays" },
  { value: "every Thursday", label: "Thursdays" },
  { value: "every Friday", label: "Fridays" },
  { value: "every Saturday", label: "Saturdays" },
  { value: "every Sunday", label: "Sundays" },
];

const PICKER_TIMES: { value: string; label: string }[] = [
  { value: "at 6am", label: "6:00 AM" },
  { value: "at 8am", label: "8:00 AM" },
  { value: "at 9am", label: "9:00 AM" },
  { value: "at 12pm", label: "12:00 PM" },
  { value: "at 3pm", label: "3:00 PM" },
  { value: "at 5pm", label: "5:00 PM" },
  { value: "at 8pm", label: "8:00 PM" },
];

function formatRun(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Schedule preview (pure, client-side — no server round-trip) ─────────────────────

function SchedulePreview({ text }: { text: string }) {
  const result = useMemo(() => {
    if (!text.trim()) return null;
    const parsed = parseSchedule(text);
    if (!parsed.ok) return { error: parsed.reason };
    const runs = nextRuns(parsed.schedule.cron, 3, new Date(), {
      biWeekly: parsed.schedule.biWeekly,
    });
    return { summary: parsed.schedule.summary, runs };
  }, [text]);

  if (!result) return null;
  if ("error" in result) {
    return <p className="mt-2 text-xs text-amber-400">{result.error}</p>;
  }
  return (
    <div className="mt-2 rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-2.5">
      <p className="text-xs font-semibold text-[#22d3ee]">{result.summary}</p>
      <p className="mt-1 text-[11px] text-slate-400">
        Next 3 runs: {result.runs.map((r) => formatRun(r.toISOString())).join(" · ")}
      </p>
    </div>
  );
}

// ── Create flow ─────────────────────────────────────────────────────────────────────

// A Signal Catcher hand-off (PA-SIGNAL-1): the proposal card's Edit path lands here with the
// wizard open and pre-filled. Creating the ritual settles the originating catch + its card.
export type PrefillView = {
  name: string;
  appSlug: string;
  scheduleText: string;
  signalCatchId: string;
};

function CreateRitual({
  apps,
  atCap,
  onCreated,
  prefill,
}: {
  apps: AppOption[];
  atCap: boolean;
  onCreated: () => void;
  prefill: PrefillView | null;
}) {
  const [open, setOpen] = useState(Boolean(prefill));
  const [name, setName] = useState(prefill?.name ?? "");
  const [appSlug, setAppSlug] = useState(prefill?.appSlug ?? apps[0]?.id ?? "");
  const [scheduleText, setScheduleText] = useState(prefill?.scheduleText ?? "");
  const [delivery, setDelivery] = useState<Delivery>("inbox");
  const [showPicker, setShowPicker] = useState(false);
  const [pickDay, setPickDay] = useState(PICKER_DAYS[0].value);
  const [pickTime, setPickTime] = useState(PICKER_TIMES[2].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPicker(day: string, time: string) {
    setScheduleText(`${day} ${time}`);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/app/rituals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "manual",
        name: name.trim(),
        appSlug,
        scheduleText,
        delivery,
        ...(prefill ? { signalCatchId: prefill.signalCatchId } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      setError(data.message || data.error || "Couldn't create the ritual.");
      return;
    }
    setName("");
    setScheduleText("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={atCap}
        className="rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-4 py-2.5 text-sm font-semibold text-[#22d3ee] hover:bg-[#22d3ee]/10 disabled:opacity-40"
      >
        + Create a ritual
      </button>
    );
  }

  const app = apps.find((a) => a.id === appSlug);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
      <div>
        <label className={LABEL_CLASS}>What should it do?</label>
        <select value={appSlug} onChange={(e) => setAppSlug(e.target.value)} className={FIELD_CLASS}>
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {app && <p className="mt-1.5 text-xs text-slate-400">{app.blurb}</p>}
      </div>

      <div className="mt-4">
        <label className={LABEL_CLASS}>When?</label>
        <input
          value={scheduleText}
          onChange={(e) => setScheduleText(e.target.value)}
          placeholder="e.g. every Monday at 8am"
          className={FIELD_CLASS}
        />
        <SchedulePreview text={scheduleText} />
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="mt-2 text-[11px] text-slate-500 hover:text-slate-300"
        >
          {showPicker ? "Hide day + time picker" : "Or pick a day and time"}
        </button>
        {showPicker && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <select
              value={pickDay}
              onChange={(e) => {
                setPickDay(e.target.value);
                applyPicker(e.target.value, pickTime);
              }}
              className={FIELD_CLASS}
            >
              {PICKER_DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              value={pickTime}
              onChange={(e) => {
                setPickTime(e.target.value);
                applyPicker(pickDay, e.target.value);
              }}
              className={FIELD_CLASS}
            >
              {PICKER_TIMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Name it</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monday Pipeline Review"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>How to get the result</label>
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as Delivery)}
            className={FIELD_CLASS}
          >
            <option value="inbox">A card in Mission Control</option>
            <option value="email_digest">An email to you</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !name.trim() || !scheduleText.trim()}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create ritual"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Ritual row ──────────────────────────────────────────────────────────────────────

function RitualRow({
  ritual,
  appLabel,
  onChanged,
}: {
  ritual: RitualView;
  appLabel: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function runNow() {
    setBusy("run");
    setNote(null);
    const res = await fetch(`/api/app/rituals/${ritual.id}/run-now`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setNote(data.error || "Couldn't run it.");
      return;
    }
    setNote("Ran it — the result is in Mission Control.");
    onChanged();
  }

  async function togglePause() {
    setBusy("pause");
    setNote(null);
    const res = await fetch(`/api/app/rituals/${ritual.id}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ritual.enabled }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setNote(data.message || data.error || "Couldn't change it.");
      return;
    }
    onChanged();
  }

  async function remove() {
    setBusy("delete");
    await fetch(`/api/app/rituals/${ritual.id}`, { method: "DELETE" });
    setBusy(null);
    onChanged();
  }

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{ritual.name}</h3>
            {!ritual.enabled && (
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-500">
                Paused
              </span>
            )}
            {ritual.lastRunStatus === "failed" && ritual.enabled && (
              <span className="rounded border border-rose-800 px-1.5 py-0.5 text-[10px] font-mono uppercase text-rose-400">
                Last run failed
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Runs {appLabel} · {ritual.scheduleText} ·{" "}
            {ritual.delivery === "email_digest" ? "emails you" : "card in Mission Control"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {ritual.enabled ? `Next ${formatRun(ritual.nextRunAt)}` : "Paused"} · last ran{" "}
            {relativeTime(ritual.lastRunAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={runNow}
          disabled={busy !== null}
          className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
        >
          {busy === "run" ? "Running…" : "Run now"}
        </button>
        <Link
          href={`/app/apps/rituals/${ritual.id}`}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-[#22d3ee]"
        >
          History
        </Link>
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

      {note && <p className="mt-3 text-xs text-[#22d3ee]">{note}</p>}
    </div>
  );
}

// ── Seed pack ───────────────────────────────────────────────────────────────────────

function SeedCard({ seed, atCap, onInstalled }: { seed: SeedView; atCap: boolean; onInstalled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function install() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/app/rituals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "seed", seedId: seed.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setError(data.message || data.error || "Couldn't install it.");
      return;
    }
    onInstalled();
  }

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
      <h4 className="text-sm font-semibold text-slate-100">{seed.name}</h4>
      <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-slate-500">{seed.scheduleText}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{seed.description}</p>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <button
        onClick={install}
        disabled={busy || atCap}
        className="mt-3 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-3 py-1.5 text-xs font-semibold text-[#22d3ee] hover:bg-[#22d3ee]/10 disabled:opacity-40"
      >
        {busy ? "Installing…" : "Install ritual"}
      </button>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────────

export default function RitualsClient({
  rituals,
  seeds,
  apps,
  cap,
  activeCount,
  hasApiKey,
  prefill,
}: {
  rituals: RitualView[];
  seeds: SeedView[];
  apps: AppOption[];
  cap: number;
  activeCount: number;
  hasApiKey: boolean;
  prefill: PrefillView | null;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const atCap = activeCount >= cap;
  const appLabelById = useMemo(() => new Map(apps.map((a) => [a.id, a.label])), [apps]);

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]/60">
            Runs on schedule
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Ritual Scheduler</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            The review you keep meaning to run every week, the digest you wish was waiting in the morning
            — tell PA once and it runs on that schedule for good. Pick which App fires, type the schedule
            in plain words, and the result lands in Mission Control when you sit down. Pause, edit, or
            delete any of them from here.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Running <span className="text-slate-100">{activeCount}</span> of{" "}
            <span className="text-slate-100">{cap}</span> rituals on your plan.
            {atCap && " Pause or delete one to add another."}
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
            <span className="mt-0.5 shrink-0 font-mono text-sm text-[#22d3ee]">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Add your Anthropic API key so the Apps a ritual fires can do their work.
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Your key, your bill, your data.{" "}
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Go to Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <CreateRitual apps={apps} atCap={atCap} onCreated={refresh} prefill={prefill} />
        </div>

        {rituals.length > 0 && (
          <div className="mb-10 flex flex-col gap-3">
            {rituals.map((r) => (
              <RitualRow
                key={r.id}
                ritual={r}
                appLabel={(r.appSlug && appLabelById.get(r.appSlug)) || r.appSlug || "an App"}
                onChanged={refresh}
              />
            ))}
          </div>
        )}

        <div className="border-t border-slate-800/60 pt-6">
          <h2 className="text-sm font-semibold text-slate-100">Start with a ready ritual</h2>
          <p className="mt-1 text-xs text-slate-400">
            Install one in a tap, then edit the schedule or App to fit how you work.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {seeds.map((s) => (
              <SeedCard key={s.id} seed={s} atCap={atCap} onInstalled={refresh} />
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800/60 pt-6">
          <p className="text-sm leading-relaxed text-slate-500">
            Every result stages in{" "}
            <Link href="/app/mission-control" className="text-slate-400 hover:text-[#22d3ee]">
              Mission Control
            </Link>{" "}
            — review it on your tap. A ritual that fails five times in a row pauses itself and flags why.
          </p>
        </div>
      </div>
    </div>
  );
}
