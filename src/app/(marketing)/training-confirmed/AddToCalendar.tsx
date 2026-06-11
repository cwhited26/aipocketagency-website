"use client";

import { useCallback } from "react";

// Generates a real .ics for the scheduled webinar and triggers a download (Part 3B "Add To Calendar").
// The start time comes from the server (resolved from WEBINAR_NEXT_SESSION_AT) — no date is hardcoded
// here. When the session isn't scheduled yet (startIso null), the button is disabled with a hint.
function icsDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC).
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export default function AddToCalendar({
  startIso,
  durationMinutes,
  title,
  description,
  url,
}: {
  startIso: string | null;
  durationMinutes: number;
  title: string;
  description: string;
  url: string;
}) {
  const handleClick = useCallback(() => {
    if (!startIso) return;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    // A stable UID derived from the start time (no Math.random / Date.now in the value so re-downloads
    // resolve to the same calendar event).
    const uid = `webinar-${icsDate(start)}@aipocketagent.com`;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pocket Agent//Webinar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${icsDate(start)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `URL:${escapeIcsText(url)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "pocket-agent-training.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }, [startIso, durationMinutes, title, description, url]);

  if (!startIso) {
    return (
      <div className="text-center">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-base font-semibold text-slate-500"
        >
          Add To Calendar
        </button>
        <p className="mt-2 text-xs text-slate-500">
          The session time is being finalized — watch your email for the calendar invite.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] sm:text-lg"
    >
      Add To Calendar
    </button>
  );
}
