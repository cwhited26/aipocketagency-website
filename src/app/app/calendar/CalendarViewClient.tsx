"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// UI-safe event projection — mirrors ListedEvent from the calendar connector.
type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  htmlLink: string | null;
  attendees: string[];
};

type EventsResponse = { events: CalendarEvent[] };

// "2026-06-09T14:00:00-05:00" → "Mon, Jun 9 · 2:00 PM"; bare "2026-06-09" → "Mon, Jun 9 · All day".
function formatWhen(raw: string): string {
  if (!raw || raw === "—") return "Time TBD";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (dateOnly) return `${day} · All day`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export default function CalendarViewClient({
  connected,
  accountEmail,
}: {
  connected: boolean;
  accountEmail: string | null;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(connected);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setReauth(false);

    const res = await fetch("/api/connections/calendar/events?max_results=10", {
      cache: "no-store",
    }).catch(() => null);

    if (!res) {
      setError("Network error. Check your connection and try again.");
      setIsLoading(false);
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; reauth?: boolean };
      setReauth(Boolean(body.reauth));
      setError(body.error ?? "Couldn't load your calendar. Try again.");
      setIsLoading(false);
      return;
    }

    const data = (await res.json()) as EventsResponse;
    setEvents(data.events);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Google Calendar · Connection
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Calendar</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {connected
              ? `Your next events${accountEmail ? ` from ${accountEmail}` : ""}. Your agent reads your schedule — it never writes an event without your approval.`
              : "Connect Google Calendar and your agent can see your schedule, surface conflicts, and propose times — all staged for your approval."}
          </p>
        </div>

        {!connected && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-slate-100">No calendar connected</p>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
              Once Google Calendar is connected, your upcoming events show up here.
            </p>
            <Link
              href="/app/settings/connections"
              className="inline-flex items-center gap-2 mt-5 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#22d3ee] text-sm font-medium px-4 py-2 hover:bg-[#22d3ee]/15 transition-colors"
            >
              Connect Google Calendar →
            </Link>
          </div>
        )}

        {connected && isLoading && (
          <p className="text-sm text-slate-500 font-mono">Loading your events…</p>
        )}

        {connected && !isLoading && error && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4">
            <p className="text-sm text-slate-200">{error}</p>
            {reauth ? (
              <Link
                href="/app/settings/connections"
                className="inline-block mt-3 text-sm text-[#22d3ee] hover:underline"
              >
                Reconnect Google Calendar →
              </Link>
            ) : (
              <button
                onClick={() => void load()}
                className="mt-3 text-sm text-[#22d3ee] hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {connected && !isLoading && !error && events.length === 0 && (
          <p className="text-sm text-slate-500">Nothing on your calendar in the next week.</p>
        )}

        {connected && !isLoading && !error && events.length > 0 && (
          <ul className="space-y-2.5">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{ev.summary}</p>
                    <p className="text-xs text-[#22d3ee]/70 font-mono mt-1">{formatWhen(ev.start)}</p>
                    {ev.location && (
                      <p className="text-xs text-slate-500 mt-1 truncate">📍 {ev.location}</p>
                    )}
                    {ev.attendees.length > 0 && (
                      <p className="text-xs text-slate-600 mt-1 truncate">
                        {ev.attendees.length} attendee{ev.attendees.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  {ev.htmlLink && (
                    <a
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[11px] text-slate-500 hover:text-[#22d3ee] transition-colors font-mono"
                    >
                      Open →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
