"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Citation = { file: string; line: string };
type BriefResponse = { brief: string; citations: Citation[]; hasBrain: boolean };

// One merged timeline entry — a Google Calendar event or a Calendly booking, normalized so the UI
// renders both the same way. `source` drives the small origin badge.
type TimelineItem = {
  source: "calendar" | "calendly";
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  status: string | null;
};

type CalendarEventsResponse = {
  events?: { summary?: string; start?: string; end?: string; location?: string | null }[];
};
type CalendlyEventsResponse = {
  events?: { name?: string; start?: string | null; end?: string | null; location?: string | null; status?: string | null }[];
};

function startMs(item: TimelineItem): number {
  if (!item.start) return Number.POSITIVE_INFINITY;
  const t = new Date(item.start).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CalendarClient({
  brainRepo,
  hasApiKey,
  hasCalendar,
  hasCalendly,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  hasCalendar: boolean;
  hasCalendly: boolean;
}) {
  const [upcoming, setUpcoming] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [hasBrain, setHasBrain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Live merged timeline (Google Calendar + Calendly) ──────────────────────────
  const anyConnected = hasCalendar || hasCalendly;
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!anyConnected) return;
    setTimelineLoading(true);
    setTimelineError(null);

    const items: TimelineItem[] = [];
    const problems: string[] = [];

    if (hasCalendar) {
      const res = await fetch("/api/connections/calendar/events", { cache: "no-store" }).catch(
        () => null,
      );
      if (res && res.ok) {
        const data = (await res.json().catch(() => ({}))) as CalendarEventsResponse;
        for (const e of data.events ?? []) {
          items.push({
            source: "calendar",
            title: e.summary || "(no title)",
            start: e.start ?? null,
            end: e.end ?? null,
            location: e.location ?? null,
            status: null,
          });
        }
      } else if (res) {
        problems.push("Google Calendar");
      }
    }

    if (hasCalendly) {
      const res = await fetch("/api/connections/calendly/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_scheduled_events" }),
        cache: "no-store",
      }).catch(() => null);
      if (res && res.ok) {
        const data = (await res.json().catch(() => ({}))) as CalendlyEventsResponse;
        for (const e of data.events ?? []) {
          items.push({
            source: "calendly",
            title: e.name || "(no title)",
            start: e.start ?? null,
            end: e.end ?? null,
            location: e.location ?? null,
            status: e.status ?? null,
          });
        }
      } else if (res) {
        problems.push("Calendly");
      }
    }

    items.sort((a, b) => startMs(a) - startMs(b));
    setTimeline(items);
    setTimelineError(
      problems.length ? `Couldn't load ${problems.join(" and ")} — try reconnecting.` : null,
    );
    setTimelineLoading(false);
  }, [anyConnected, hasCalendar, hasCalendly]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  async function handleScan() {
    if (!hasApiKey || isLoading) return;
    setIsLoading(true);
    setError(null);
    setUpcoming("");
    setCitations([]);

    const res = await fetch("/api/app/apps/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);

    if (!res) {
      setError("Network error. Check your connection and try again.");
      setIsLoading(false);
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (body.error === "no_api_key") {
        setError("no_api_key");
      } else {
        setError(body.message ?? body.error ?? "Something went wrong. Try again.");
      }
      setIsLoading(false);
      return;
    }

    const data = (await res.json()) as BriefResponse;
    setUpcoming(data.brief);
    setCitations(data.citations);
    setHasBrain(data.hasBrain);
    setIsLoading(false);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Brain-powered · Upcoming
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Calendar</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {brainRepo
              ? `Scans ${brainRepo} for anything date or deadline related — upcoming jobs, scheduled calls, pending deadlines, follow-up timelines.`
              : "Your agent scans your brain for any upcoming dates, deadlines, or scheduled items it knows about. Connect a brain to make it specific."}
          </p>
        </div>

        {/* Live merged timeline: Google Calendar (your schedule) + Calendly (prospect bookings) */}
        {anyConnected && (
          <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Your schedule
                <span className="ml-2 text-slate-600">
                  {hasCalendar && hasCalendly
                    ? "· Google Calendar + Calendly"
                    : hasCalendar
                      ? "· Google Calendar"
                      : "· Calendly bookings"}
                </span>
              </span>
              <button
                onClick={() => void loadTimeline()}
                disabled={timelineLoading}
                className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] disabled:opacity-40 transition-colors"
              >
                {timelineLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {timelineError && (
              <div className="px-5 py-3 text-xs text-amber-400/90 border-b border-slate-800">
                {timelineError}
              </div>
            )}

            <div className="divide-y divide-slate-800/70">
              {timeline.length === 0 && !timelineLoading ? (
                <p className="px-5 py-5 text-sm text-slate-500">
                  Nothing on the calendar in the next few weeks.
                </p>
              ) : (
                timeline.map((item, i) => (
                  <div key={`${item.source}-${i}`} className="px-5 py-3 flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                        item.source === "calendly"
                          ? "text-[#22d3ee] border-[#22d3ee]/30 bg-[#22d3ee]/5"
                          : "text-slate-400 border-slate-700/60"
                      }`}
                    >
                      {item.source === "calendly" ? "Calendly" : "Calendar"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100 truncate">
                        {item.title}
                        {item.status && item.status !== "active" ? (
                          <span className="ml-2 text-[11px] text-amber-400/80">({item.status})</span>
                        ) : null}
                      </p>
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        {whenLabel(item.start)}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Brain scan section */}
        {hasApiKey && brainRepo && (
          <div className="mb-6">
            <button
              onClick={handleScan}
              disabled={isLoading}
              className="w-full rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Scanning brain for upcoming items…" : "Scan brain for what's upcoming"}
            </button>
          </div>
        )}

        {!hasApiKey && (
          <div className="mb-6 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4 flex items-start gap-3">
            <span className="text-[#22d3ee] shrink-0 mt-0.5 font-mono text-sm">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">API key required</p>
              <p className="text-sm text-slate-300 mt-1">
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Add your Anthropic key in Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        {error && error !== "no_api_key" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {upcoming && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Upcoming from brain
                {!hasBrain && (
                  <span className="ml-2 text-amber-500/70">· no brain connected</span>
                )}
              </span>
            </div>
            <div className="px-5 py-4">
              <pre className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {upcoming}
              </pre>
            </div>
            {citations.length > 0 && (
              <div className="border-t border-slate-800 px-5 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-mono text-[#22d3ee]/60"
                    >
                      {c.file}
                      {c.line ? `:${c.line}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connect seam — shown only when neither booking surface is connected yet */}
        {!anyConnected && (
          <div className="rounded-xl border border-slate-800/40 bg-transparent px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-400">
                  Connect Google Calendar and Calendly for a live schedule
                </p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Google Calendar is your own schedule; Calendly is how prospects self-book. Connect
                  either in{" "}
                  <Link href="/app/settings/connections" className="text-[#22d3ee] hover:underline">
                    Settings → Connections
                  </Link>{" "}
                  and your real meetings and bookings show up here in one timeline, next to what your
                  brain knows.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
