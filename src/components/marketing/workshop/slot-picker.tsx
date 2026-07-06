"use client";

// Slot picker for /workshop (PA-POS-38 §24.4): three sessions a day for the next seven days,
// generated client-side in the visitor's detected timezone. Selecting a slot routes to the
// order form with the slot + timezone in the query string; the server re-validates both.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MONO_FONT } from "@/components/marketing/cta";
import { upcomingSlots, type WorkshopSlot } from "@/lib/workshop/slots";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type DayGroup = { dayLabel: string; slots: Array<{ slot: WorkshopSlot; timeLabel: string }> };

function groupByDay(slots: WorkshopSlot[], timeZone: string): DayGroup[] {
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const groups = new Map<string, DayGroup>();
  for (const slot of slots) {
    const dayLabel = dayFmt.format(slot.epochMs);
    const entry = groups.get(dayLabel) ?? { dayLabel, slots: [] };
    entry.slots.push({ slot, timeLabel: timeFmt.format(slot.epochMs) });
    groups.set(dayLabel, entry);
  }
  return [...groups.values()];
}

export function WorkshopSlotPicker() {
  // Timezone + slots resolve after mount so the server-rendered HTML never disagrees with the
  // client (slots are wall-clock-dependent).
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [timeZone, setTimeZone] = useState<string>("UTC");

  useEffect(() => {
    setTimeZone(detectTimeZone());
    setNowMs(Date.now());
  }, []);

  const groups = useMemo(() => {
    if (nowMs === null) return [];
    return groupByDay(upcomingSlots(nowMs, timeZone), timeZone);
  }, [nowMs, timeZone]);

  return (
    <div id="sessions">
      <div className="mb-3 text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
        [ pick your session · times shown in {timeZone.replace(/_/g, " ")} ]
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{WORKSHOP_COPY.slotPicker.heading}</h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-300">
        {WORKSHOP_COPY.slotPicker.sub}
      </p>
      <div className="mt-8 space-y-5">
        {nowMs === null ? (
          <p className="text-sm text-slate-400">Loading sessions in your timezone…</p>
        ) : (
          groups.map((g) => (
            <div key={g.dayLabel} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-32 shrink-0 text-sm font-semibold text-slate-200">{g.dayLabel}</div>
              <div className="flex flex-wrap gap-3">
                {g.slots.map(({ slot, timeLabel }) => (
                  <Link
                    key={slot.iso}
                    href={`/workshop/checkout?slot=${encodeURIComponent(slot.iso)}&tz=${encodeURIComponent(timeZone)}`}
                    className="inline-flex items-center rounded-full border border-accent/40 bg-accent/[0.04] px-5 py-2 text-sm font-semibold text-accent transition hover:scale-[1.02] hover:bg-accent/[0.1]"
                  >
                    {timeLabel}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
