"use client";

// The pre-workshop lobby (PA-POS-38 §24.4). Locked until T-15; then a full-screen countdown,
// Chase's 30-second welcome loop (top-left card, muted autoplay), the pre-show fake-live chat,
// and the three-item checklist bar. All three ticked + T-0 → auto-redirect to the player.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MONO_FONT } from "@/components/marketing/cta";
import { WorkshopChatFeed } from "@/components/marketing/workshop/chat-feed";
import { LOBBY_OPEN_MINUTES } from "@/lib/workshop/slots";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

type LobbyState = {
  phase: "locked" | "open" | "live" | "ended";
  slot_at: string;
  slot_display: string;
  welcome_embed_src: string | null;
};

const CHECKLIST_KEY = "pa-workshop-lobby-checklist";

export function LobbyClient({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LobbyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workshop/lobby/${registrationId}`, { cache: "no-store" }).catch(
      () => null,
    );
    if (!res || !res.ok) {
      setError("We couldn't load your session. Refresh the page — your seat is safe.");
      return;
    }
    setState((await res.json()) as LobbyState);
    setError(null);
  }, [registrationId]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CHECKLIST_KEY);
      if (saved) setChecks(JSON.parse(saved) as boolean[]);
    } catch {
      // storage blocked — checklist just starts unticked
    }
  }, []);

  const slotAtMs = state ? Date.parse(state.slot_at) : null;
  const remainingMs = slotAtMs !== null ? slotAtMs - nowMs : null;
  const allChecked = checks.every(Boolean);

  // T-0 + checklist done → into the player. (T-0 without the checklist shows the start button.)
  useEffect(() => {
    if (state && remainingMs !== null && remainingMs <= 0 && allChecked) {
      router.replace(`/workshop/live/${registrationId}`);
    }
  }, [state, remainingMs, allChecked, router, registrationId]);

  const countdown = useMemo(() => {
    if (remainingMs === null) return "";
    const total = Math.max(0, Math.floor(remainingMs / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remainingMs]);

  function toggle(i: number) {
    setChecks((prev) => {
      const next = prev.map((v, idx) => (idx === i ? !v : v));
      try {
        window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        // storage blocked — state still updates for this visit
      }
      return next;
    });
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-6 text-slate-100">
        <p className="max-w-md text-center text-sm text-slate-300">{error}</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-6 text-slate-100">
        <p className="text-sm text-slate-400">Loading your session…</p>
      </main>
    );
  }

  if (state.phase === "locked") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-6 text-slate-100">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-block text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
            [ workshop lobby ]
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{WORKSHOP_COPY.lobby.lockedHeading}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            Your session is at <span className="font-semibold text-slate-100">{state.slot_display}</span>.
            This page unlocks {LOBBY_OPEN_MINUTES} minutes before it starts.
          </p>
        </div>
      </main>
    );
  }

  const pastStart = remainingMs !== null && remainingMs <= 0;
  const lobbyOpenedMs = slotAtMs !== null ? slotAtMs - LOBBY_OPEN_MINUTES * 60_000 : nowMs;
  const preShowSec = Math.max(0, Math.floor((nowMs - lobbyOpenedMs) / 1000));

  return (
    <main className="flex min-h-screen flex-col bg-[#05070a] px-4 py-4 text-slate-100 sm:px-6">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col items-center">
          {/* Welcome loop — top-left card */}
          <div className="w-full">
            <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-white/10">
              {state.welcome_embed_src ? (
                <iframe
                  src={state.welcome_embed_src}
                  className="aspect-video w-full"
                  allow="autoplay"
                  title="Welcome from Chase"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-white/[0.03] text-xs text-slate-400">
                  Chase&apos;s welcome loop plays here
                </div>
              )}
            </div>
          </div>
          {/* Full-screen countdown — top center */}
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <div className="text-xs text-cyan-300/70" style={{ fontFamily: MONO_FONT }}>
              [ your session starts in ]
            </div>
            <div className="mt-3 text-7xl font-extrabold tabular-nums tracking-tight sm:text-8xl">
              {pastStart ? "00:00" : countdown}
            </div>
            <p className="mt-4 text-sm text-slate-400">{state.slot_display}</p>
            {pastStart ? (
              <button
                type="button"
                onClick={() => router.replace(`/workshop/live/${registrationId}`)}
                className="mt-6 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02]"
              >
                Start the workshop →
              </button>
            ) : null}
          </div>
        </div>
        {/* Pre-show chat — right */}
        <div className="min-h-[280px]">
          <WorkshopChatFeed
            segment="pre_show"
            positionSec={preShowSec}
            registrationId={registrationId}
            allowInput
          />
        </div>
      </div>
      {/* Checklist bar — bottom */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4">
            {WORKSHOP_COPY.lobby.checklist.map((item, i) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={checks[i] ?? false}
                  onChange={() => toggle(i)}
                  className="h-4 w-4 accent-cyan-400"
                />
                {item}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-400">{WORKSHOP_COPY.lobby.checklistHint}</p>
        </div>
      </div>
    </main>
  );
}
