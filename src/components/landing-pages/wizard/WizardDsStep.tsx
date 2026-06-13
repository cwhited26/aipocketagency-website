"use client";

// WizardDsStep — shared "Base the design on something?" step (PA-LPB-13 / PA-LPB-14).
// Used by both the fresh-create wizard and the gallery "Use this template" flow.
// Manages its own scene/clone state; calls onChange whenever the selection resolves or changes.
// Reset externally by changing the `key` prop (e.g. keyed on the scope selection).

import { useEffect, useState } from "react";

export type DsPreview = {
  designSystemId: string;
  name?: string;
  palette?: { name?: string; hex?: string; role?: string }[];
  typography?: { heading?: { family?: string }; body?: { family?: string } };
  importedFrom: string;
};

export type DsSelection =
  | { kind: "skip" }
  | { kind: "moonchild"; sceneId: string; sceneName: string; preview: DsPreview }
  | { kind: "clone"; url: string; preview: DsPreview };

type DsChoice = "moonchild" | "clone" | "skip";
type MoonchildScene = { id: string; name: string; thumbnail_url?: string };

type Props = {
  moonchildOwnerConnected: boolean;
  onChange: (selection: DsSelection) => void;
};

export default function WizardDsStep({ moonchildOwnerConnected, onChange }: Props) {
  const [dsChoice, setDsChoice] = useState<DsChoice>("skip");
  const [scenes, setScenes] = useState<MoonchildScene[] | null>(null);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneImporting, setSceneImporting] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloning, setCloning] = useState(false);
  const [dsPreview, setDsPreview] = useState<DsPreview | null>(null);
  const [dsError, setDsError] = useState<string | null>(null);

  useEffect(() => {
    if (dsChoice !== "moonchild" || scenes !== null || loadingScenes) return;
    setLoadingScenes(true);
    fetch("/api/app/apps/landing-pages/moonchild-scenes")
      .then((r) => r.json() as Promise<{ scenes?: MoonchildScene[]; error?: string }>)
      .then((data) => setScenes(data.scenes ?? []))
      .catch(() => setScenes([]))
      .finally(() => setLoadingScenes(false));
  }, [dsChoice, scenes, loadingScenes]);

  function switchChoice(choice: DsChoice) {
    setDsChoice(choice);
    setDsPreview(null);
    setDsError(null);
    if (choice !== "moonchild") setSelectedSceneId(null);
    if (choice === "skip") onChange({ kind: "skip" });
  }

  async function importScene(sceneId: string, sceneName: string) {
    setSceneImporting(true);
    setDsError(null);
    setDsPreview(null);
    try {
      const res = await fetch("/api/app/apps/landing-pages/moonchild-import-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, sceneName }),
      });
      const data = (await res.json()) as {
        designSystem?: { name?: string; palette?: DsPreview["palette"]; typography?: DsPreview["typography"] };
        designSystemId?: string;
        importedFrom?: string;
        error?: string;
      };
      if (!res.ok || !data.designSystemId) {
        setDsError(data.error ?? "Couldn't read the design system from that scene.");
        onChange({ kind: "skip" });
        return;
      }
      setSelectedSceneId(sceneId);
      const preview: DsPreview = {
        designSystemId: data.designSystemId,
        name: data.designSystem?.name ?? sceneName,
        palette: data.designSystem?.palette,
        typography: data.designSystem?.typography,
        importedFrom: data.importedFrom ?? `moonchild:scene:${sceneId}`,
      };
      setDsPreview(preview);
      onChange({ kind: "moonchild", sceneId, sceneName: preview.name ?? sceneName, preview });
    } finally {
      setSceneImporting(false);
    }
  }

  async function cloneDesign() {
    if (!cloneUrl.trim()) return;
    setCloning(true);
    setDsError(null);
    setDsPreview(null);
    try {
      const res = await fetch("/api/app/apps/landing-pages/clone-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cloneUrl.trim() }),
      });
      const data = (await res.json()) as {
        snapshot?: { name?: string; palette?: DsPreview["palette"]; typography?: DsPreview["typography"] };
        importedFrom?: string;
        error?: string;
      };
      if (!res.ok || !data.snapshot) {
        setDsError(data.error ?? "Couldn't read the design from that site. Try a different URL.");
        onChange({ kind: "skip" });
        return;
      }
      const preview: DsPreview = {
        designSystemId: `clone:${Date.now()}`,
        name: data.snapshot.name,
        palette: data.snapshot.palette,
        typography: data.snapshot.typography,
        importedFrom: data.importedFrom ?? `clone:${cloneUrl.trim()}`,
      };
      setDsPreview(preview);
      onChange({ kind: "clone", url: cloneUrl.trim(), preview });
    } finally {
      setCloning(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-[12px] font-medium text-slate-300 mb-2">
        Base the page design on something specific?
      </p>
      <div className={`grid gap-1.5 mb-2 ${moonchildOwnerConnected ? "grid-cols-3" : "grid-cols-2"}`}>
        {moonchildOwnerConnected && (
          <button
            type="button"
            onClick={() => switchChoice("moonchild")}
            className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
              dsChoice === "moonchild"
                ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <p className="text-[12px] font-semibold text-slate-100 leading-snug">
              Pull from my Moonchild project
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Pick a scene from your account
            </p>
          </button>
        )}
        <button
          type="button"
          onClick={() => switchChoice("clone")}
          className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
            dsChoice === "clone"
              ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
          }`}
        >
          <p className="text-[12px] font-semibold text-slate-100 leading-snug">Match a site&apos;s look</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
            Paste a URL — style tokens only
          </p>
        </button>
        <button
          type="button"
          onClick={() => switchChoice("skip")}
          className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
            dsChoice === "skip"
              ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
          }`}
        >
          <p className="text-[12px] font-semibold text-slate-100 leading-snug">Skip — let PA pick</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Uses template defaults</p>
        </button>
      </div>

      {dsChoice === "moonchild" && (
        <div className="mt-2">
          {loadingScenes && (
            <p className="text-[11px] text-slate-500 py-1">Loading your scenes…</p>
          )}
          {!loadingScenes && scenes !== null && scenes.length === 0 && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No scenes found in your Moonchild account. Build a design system in{" "}
              <span className="text-[#22d3ee]/80 font-mono">studio.moonchild.ai</span> first, then
              come back.
            </p>
          )}
          {!loadingScenes && scenes && scenes.length > 0 && (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {scenes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSceneId(s.id);
                    void importScene(s.id, s.name);
                  }}
                  disabled={sceneImporting}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
                    selectedSceneId === s.id && dsPreview
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <p className="text-[12px] font-semibold text-slate-100">{s.name}</p>
                  {sceneImporting && selectedSceneId === s.id && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Reading design system…</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {dsChoice === "clone" && (
        <div className="flex gap-2 mt-2">
          <input
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="https://theclient.com"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#22d3ee]/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void cloneDesign()}
            disabled={cloning || !cloneUrl.trim()}
            className="rounded-lg border border-slate-700 px-3 py-2 text-[13px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            {cloning ? "Reading…" : "Read it"}
          </button>
        </div>
      )}

      {dsError && <p className="text-[11px] text-amber-300 mt-1.5">{dsError}</p>}

      {dsPreview && dsChoice !== "skip" && (
        <div className="mt-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            {dsPreview.palette?.slice(0, 5).map((p, i) =>
              p.hex ? (
                <span
                  key={i}
                  className="w-4 h-4 rounded-full border border-white/10 shrink-0"
                  style={{ backgroundColor: p.hex }}
                  title={p.role ?? p.name ?? p.hex}
                />
              ) : null,
            )}
            <p className="text-[12px] font-semibold text-emerald-300">
              {dsPreview.name ?? "Design system"} ready
            </p>
          </div>
          {dsPreview.typography?.heading?.family && (
            <p className="text-[11px] text-slate-400">
              Typography: {dsPreview.typography.heading.family}
              {dsPreview.typography.body?.family &&
              dsPreview.typography.body.family !== dsPreview.typography.heading.family
                ? ` / ${dsPreview.typography.body.family}`
                : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
