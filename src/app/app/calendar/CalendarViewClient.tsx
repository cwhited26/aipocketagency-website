"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TabGuide } from "../_components/TabGuide";
import { StarterBox } from "../_components/StarterBox";

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

        <p className="text-sm text-slate-300 leading-relaxed mb-8">
          Once your calendar is connected, your agent can read it like you do. Ask it to find a
          30-minute slot next week and propose a showing to a buyer, and it checks for conflicts and
          stages the invite in your Inbox. Ask what you should prep for tomorrow&apos;s walkthrough and
          it pulls your notes from the last one. It can create, move, or cancel events — but every
          change waits for your approval before it touches your real calendar. Nothing gets booked
          behind your back.
        </p>

        {connected && (
          <div className="mb-8">
            <StarterBox
              placeholder="Ask your agent to find a time, propose a meeting, or prep you for one…"
              submitLabel="Ask →"
              rows={2}
            />
          </div>
        )}

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

        {/* First-touch guide — what to ask, what this connects to, and a sample day */}
        <div className="mt-10">
          <TabGuide
            promptsHeading="Try one of these"
            prompts={[
              "Find a 30-minute slot next week and propose a showing to the Okafor buyers",
              "Pull my notes from the last walkthrough at 42 Birch",
              "What's on my calendar tomorrow, and what should I prep for?",
            ]}
            worksWith={[
              {
                href: "/app/email",
                label: "Email",
                blurb: "Once you approve an invite, your agent can send it from your Gmail.",
              },
              {
                href: "/app/apps/inbox",
                label: "Inbox",
                blurb: "Every event your agent wants to create or move waits there for your tap.",
              },
              {
                href: "/app/personas",
                label: "Personas",
                blurb: "Have a sales persona build the prep doc before a discovery call.",
              },
            ]}
            exampleLabel="See an example day"
            exampleNote="This is a sample. Your real events show above once Google Calendar is connected."
          >
            <ul className="flex flex-col gap-2">
              {[
                { t: "Showing — 42 Birch St", w: "Mon, Jun 9 · 10:00 AM", who: "The Okafor buyers" },
                { t: "Listing walkthrough — 8 Cedar Ct", w: "Tue, Jun 10 · 2:00 PM", who: "New seller" },
                { t: "Buyer call (hold)", w: "Wed, Jun 11 · 9:00 AM", who: "Proposed by your agent — waiting on you" },
              ].map((ev) => (
                <li
                  key={ev.t}
                  className="rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-100">{ev.t}</p>
                  <p className="text-xs text-[#22d3ee]/70 font-mono mt-1">{ev.w}</p>
                  <p className="text-xs text-slate-500 mt-1">{ev.who}</p>
                </li>
              ))}
            </ul>
          </TabGuide>
        </div>
      </div>
    </div>
  );
}
