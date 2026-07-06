"use client";

// The workshop player (PA-POS-38 §24.4). Full-screen video with NO controls (a pointer-blocking
// overlay covers the no-UI Stream iframe — can't scrub, can't pause), elapsed timer top-right,
// and the three timestamp-driven panels below: fake-live chat (left), workbook viewer (middle),
// action buttons (right).
//
// Position source: the Cloudflare Stream player SDK's timeupdate when the video is provisioned;
// otherwise wall-clock seconds since the slot started. Either way every panel keys off ONE
// positionSec value, and the timing logic itself lives in lib/workshop/live.ts (unit-tested).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MONO_FONT } from "@/components/marketing/cta";
import { WorkshopChatFeed } from "@/components/marketing/workshop/chat-feed";
import type { WorkshopAction } from "@/data/workshop/action-script";
import {
  actionTarget,
  claudeConnectUrl,
  currentWorkbookPage,
  visibleActions,
} from "@/lib/workshop/live";
import { WORKSHOP_COPY } from "@/lib/workshop/copy";

type VideoState =
  | { kind: "loading" }
  | { kind: "not_at_slot"; slotAt: string }
  | { kind: "unprovisioned" }
  | { kind: "ready"; embedSrc: string };

type StreamPlayer = {
  currentTime: number;
  addEventListener: (event: string, cb: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

const STREAM_SDK_SRC = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
const HEARTBEAT_MS = 15_000;

export function PlayerClient({ registrationId }: { registrationId: string }) {
  const [video, setVideo] = useState<VideoState>({ kind: "loading" });
  const [slotAtMs, setSlotAtMs] = useState<number | null>(null);
  const [positionSec, setPositionSec] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<StreamPlayer | null>(null);
  const positionRef = useRef(0);
  positionRef.current = positionSec;

  // ── Resolve the signed video URL (and the slot, from the lobby endpoint, for clock fallback) ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const lobby = await fetch(`/api/workshop/lobby/${registrationId}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ slot_at: string }>) : null))
        .catch(() => null);
      if (!cancelled && lobby) setSlotAtMs(Date.parse(lobby.slot_at));

      const res = await fetch(`/api/workshop/video-url/${registrationId}`, {
        cache: "no-store",
      }).catch(() => null);
      if (cancelled) return;
      if (!res) {
        setVideo({ kind: "unprovisioned" });
        return;
      }
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { slot_at?: string };
        setVideo({ kind: "not_at_slot", slotAt: body.slot_at ?? "" });
        return;
      }
      if (!res.ok) {
        setVideo({ kind: "unprovisioned" });
        return;
      }
      const body = (await res.json()) as { embed_src: string };
      setVideo({ kind: "ready", embedSrc: body.embed_src });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  // ── Position: Stream SDK timeupdate when ready; wall-clock-since-slot otherwise ──
  useEffect(() => {
    if (video.kind !== "ready") return;
    let script = document.querySelector<HTMLScriptElement>(`script[src="${STREAM_SDK_SRC}"]`);
    let cancelled = false;
    function attach() {
      if (cancelled || !iframeRef.current || !window.Stream) return;
      const player = window.Stream(iframeRef.current);
      playerRef.current = player;
      player.addEventListener("timeupdate", () => {
        if (!cancelled) setPositionSec(Math.floor(player.currentTime));
      });
    }
    if (window.Stream) {
      attach();
    } else if (!script) {
      script = document.createElement("script");
      script.src = STREAM_SDK_SRC;
      script.async = true;
      script.addEventListener("load", attach);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", attach);
    }
    return () => {
      cancelled = true;
    };
  }, [video]);

  useEffect(() => {
    if (video.kind === "ready" || slotAtMs === null) return;
    const tick = window.setInterval(() => {
      setPositionSec(Math.max(0, Math.floor((Date.now() - slotAtMs) / 1000)));
    }, 500);
    return () => window.clearInterval(tick);
  }, [video.kind, slotAtMs]);

  // ── Attendance heartbeat ──
  useEffect(() => {
    const beat = window.setInterval(() => {
      void fetch("/api/workshop/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, position_sec: positionRef.current }),
      }).catch(() => null);
    }, HEARTBEAT_MS);
    const exit = () => {
      navigator.sendBeacon(
        "/api/workshop/attendance",
        new Blob(
          [JSON.stringify({ registration_id: registrationId, position_sec: positionRef.current, exit: true })],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("pagehide", exit);
    return () => {
      window.clearInterval(beat);
      window.removeEventListener("pagehide", exit);
    };
  }, [registrationId]);

  const elapsed = useMemo(() => {
    const m = Math.floor(positionSec / 60);
    const s = positionSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [positionSec]);

  if (video.kind === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070a] text-slate-100">
        <p className="text-sm text-slate-400">Opening your session…</p>
      </main>
    );
  }

  if (video.kind === "not_at_slot") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070a] px-6 text-slate-100">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold tracking-tight">This room opens at your slot.</h1>
          <p className="mt-4 text-[15px] text-slate-300">
            Head back to your lobby — it unlocks 15 minutes before your session and walks you in.
          </p>
          <a
            href={`/workshop/lobby/${registrationId}`}
            className="mt-6 inline-block rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground"
          >
            Back to the lobby
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#05070a] px-4 py-4 text-slate-100 sm:px-6">
      {/* VIDEO — no controls, pointer-blocked overlay, elapsed timer top-right */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10">
        {video.kind === "ready" ? (
          <>
            <iframe
              ref={iframeRef}
              src={video.embedSrc}
              className="aspect-video w-full"
              allow="autoplay; encrypted-media"
              title="The Business Brain Workshop"
            />
            {/* The scrub/pause block: swallow every pointer event over the player. */}
            <div className="absolute inset-0" aria-hidden />
          </>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-white/[0.03] px-8 text-center">
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              {WORKSHOP_COPY.player.unprovisioned}
            </p>
          </div>
        )}
        <div
          className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold tabular-nums text-cyan-300"
          style={{ fontFamily: MONO_FONT }}
        >
          live · {elapsed}
        </div>
      </div>

      {/* THREE PANELS */}
      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr_340px]">
        <div className="order-2 min-h-[320px] lg:order-1">
          <WorkshopChatFeed
            segment="live"
            positionSec={positionSec}
            registrationId={registrationId}
            allowInput
          />
        </div>
        <div className="order-1 min-h-[320px] lg:order-2">
          <WorkbookPanel positionSec={positionSec} />
        </div>
        <div className="order-3 min-h-[320px]">
          <ActionsPanel registrationId={registrationId} positionSec={positionSec} />
        </div>
      </div>
    </main>
  );
}

// ── Workbook viewer — auto-scrolls to the section Chase is on ────────────────────────────────────

function WorkbookPanel({ positionSec }: { positionSec: number }) {
  const page = currentWorkbookPage(positionSec);
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-semibold text-slate-300">Workbook · page {page}</span>
        <a
          href="/workshop/workbook.pdf"
          download
          className="text-xs font-semibold text-cyan-300 hover:underline"
        >
          Download
        </a>
      </div>
      <iframe
        key={page}
        src={`/workshop/workbook.pdf#page=${page}&toolbar=0`}
        className="min-h-0 w-full flex-1"
        title={`Workbook page ${page}`}
      />
    </div>
  );
}

// ── Action buttons — the "build with me" moments ─────────────────────────────────────────────────

type ActionUiState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; label: string; href?: string }
  | { kind: "error"; message: string };

function ActionsPanel({ registrationId, positionSec }: {
  registrationId: string;
  positionSec: number;
}) {
  const actions = visibleActions(positionSec);
  const [repo, setRepo] = useState<{ url: string; fullName: string; login: string } | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold text-slate-300">
        Build with Chase
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {actions.length === 0 ? (
          <p className="text-xs text-slate-500">
            Action buttons appear here as Chase reaches each build step.
          </p>
        ) : null}
        {actions.map((action) => (
          <ActionButton
            key={`${action.kind}-${action.trigger_sec}`}
            action={action}
            registrationId={registrationId}
            repo={repo}
            onForked={setRepo}
          />
        ))}
      </div>
    </div>
  );
}

function ActionButton({ action, registrationId, repo, onForked }: {
  action: WorkshopAction;
  registrationId: string;
  repo: { url: string; fullName: string; login: string } | null;
  onForked: (r: { url: string; fullName: string; login: string }) => void;
}) {
  const [state, setState] = useState<ActionUiState>({ kind: "idle" });
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneText, setZoneText] = useState("");
  const target = actionTarget(action.kind);

  const runFork = useCallback(async () => {
    setState({ kind: "busy" });
    const res = await fetch("/api/workshop/actions/fork-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: registrationId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as {
      forked?: boolean;
      repo_url?: string;
      repo_full_name?: string;
      github_login?: string;
      needs_auth?: boolean;
      authorize_url?: string;
      error?: string;
    };
    if (data?.needs_auth && data.authorize_url) {
      window.location.href = data.authorize_url;
      return;
    }
    if (res?.ok && data?.forked && data.repo_url) {
      onForked({
        url: data.repo_url,
        fullName: data.repo_full_name ?? "",
        login: data.github_login ?? "",
      });
      setState({
        kind: "done",
        label: `✓ Forked as ${data.repo_full_name ?? "your repo"} — open`,
        href: data.repo_url,
      });
      return;
    }
    setState({ kind: "error", message: data?.error ?? "Fork failed — try the button again." });
  }, [registrationId, onForked]);

  const saveZone = useCallback(async () => {
    const zone = action.payload?.zone;
    if (!zone || !zoneText.trim()) return;
    setState({ kind: "busy" });
    const res = await fetch("/api/workshop/actions/add-zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: registrationId, zone, content: zoneText }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res?.ok && data?.ok) {
      setZoneOpen(false);
      setState({ kind: "done", label: `✓ ${zone} zone written to your Brain` });
      return;
    }
    setState({ kind: "error", message: data?.error ?? "Write failed — hit Save again." });
  }, [action.payload?.zone, registrationId, zoneText]);

  const markConnected = useCallback(() => {
    void fetch("/api/workshop/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registration_id: registrationId, connected_to_pa: true }),
    }).catch(() => null);
  }, [registrationId]);

  if (state.kind === "done") {
    return state.href ? (
      <a
        href={state.href}
        target="_blank"
        rel="noreferrer"
        className="block w-full rounded-xl border border-emerald-400/40 bg-emerald-400/[0.06] px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/[0.12]"
      >
        {state.label}
      </a>
    ) : (
      <div className="w-full rounded-xl border border-emerald-400/40 bg-emerald-400/[0.06] px-4 py-3 text-sm font-semibold text-emerald-300">
        {state.label}
      </div>
    );
  }

  if (action.kind === "add_zone") {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/[0.04] p-3">
        <button
          type="button"
          onClick={() => setZoneOpen((v) => !v)}
          className="w-full text-left text-sm font-semibold text-accent"
        >
          {action.label}
        </button>
        {zoneOpen ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={zoneText}
              onChange={(e) => setZoneText(e.target.value)}
              rows={5}
              placeholder="Paste your content — the workbook page has the prompts."
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-accent/60"
            />
            <button
              type="button"
              disabled={state.kind === "busy" || !zoneText.trim()}
              onClick={() => void saveZone()}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-50"
            >
              {state.kind === "busy" ? "Writing to your repo…" : "Save to my Brain"}
            </button>
          </div>
        ) : null}
        {state.kind === "error" ? <p className="mt-2 text-xs text-red-400">{state.message}</p> : null}
      </div>
    );
  }

  if (action.kind === "connect_claude") {
    return repo ? (
      <a
        href={claudeConnectUrl(repo.url)}
        target="_blank"
        rel="noreferrer"
        className="block w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.01]"
      >
        {action.label}
      </a>
    ) : (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <p className="text-sm font-semibold text-slate-400">{action.label}</p>
        <p className="mt-1 text-xs text-slate-500">Fork the template repo first — button above.</p>
      </div>
    );
  }

  if (action.kind === "login_to_pa") {
    return (
      <a
        href="/app/agents"
        target="_blank"
        rel="noreferrer"
        onClick={markConnected}
        className="block w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.01]"
      >
        {action.label}
      </a>
    );
  }

  // fork_repo (the default API-backed button)
  return (
    <div>
      <button
        type="button"
        disabled={state.kind === "busy"}
        onClick={() => {
          if (target.type === "api") void runFork();
        }}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:scale-[1.01] disabled:opacity-60"
      >
        {state.kind === "busy" ? "Forking your repo…" : action.label}
      </button>
      {state.kind === "error" ? <p className="mt-2 text-xs text-red-400">{state.message}</p> : null}
    </div>
  );
}
