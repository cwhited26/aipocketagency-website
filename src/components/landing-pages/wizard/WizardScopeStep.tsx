"use client";

// WizardScopeStep — shared "What is this page for?" step (PA-LPB-9 / PA-LPB-14).
// Used by both the fresh-create wizard and the gallery "Use this template" flow.
// Manages its own folder-discovery state; calls onChange whenever the selection changes.

import { useEffect, useState } from "react";
import type { ProjectFolder } from "@/lib/landing-pages/scope";

export type ScopeSelection =
  | { mode: "personal"; scope: null }
  | { mode: "project"; scope: string | null };

type Props = {
  onChange: (selection: ScopeSelection) => void;
};

export default function WizardScopeStep({ onChange }: Props) {
  const [scopeMode, setScopeMode] = useState<"personal" | "project">("personal");
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [folders, setFolders] = useState<ProjectFolder[] | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);

  useEffect(() => {
    if (scopeMode !== "project" || folders !== null) return;
    setLoadingFolders(true);
    fetch("/api/app/apps/landing-pages/project-folders")
      .then((r) => r.json() as Promise<{ folders: ProjectFolder[] }>)
      .then((data) => setFolders(data.folders ?? []))
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false));
  }, [scopeMode, folders]);

  function pickPersonal() {
    setScopeMode("personal");
    setSelectedScope(null);
    onChange({ mode: "personal", scope: null });
  }

  function pickProject() {
    setScopeMode("project");
    onChange({ mode: "project", scope: selectedScope });
  }

  function pickFolder(path: string) {
    const next = selectedScope === path ? null : path;
    setSelectedScope(next);
    onChange({ mode: "project", scope: next });
  }

  return (
    <>
      <p className="text-[12px] font-medium text-slate-400 mb-2">What is this page for?</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={pickPersonal}
          className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
            scopeMode === "personal"
              ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
          }`}
        >
          <p className="text-[13px] font-semibold text-slate-100">Me / my business</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Reads your personal brain</p>
        </button>
        <button
          type="button"
          onClick={pickProject}
          className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
            scopeMode === "project"
              ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
              : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
          }`}
        >
          <p className="text-[13px] font-semibold text-slate-100">A specific project or client</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Reads that project&apos;s brain folder
          </p>
        </button>
      </div>

      {scopeMode === "project" && (
        <div className="mb-3">
          {loadingFolders && (
            <p className="text-[12px] text-slate-500 py-2">
              Looking for project folders in your brain…
            </p>
          )}
          {!loadingFolders && folders !== null && folders.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-[12px] text-slate-300 leading-relaxed">
                Your brain doesn&apos;t have project folders yet. Drop a{" "}
                <code className="text-[#22d3ee] font-mono">brand.md</code> or a{" "}
                <code className="text-[#22d3ee] font-mono">memory/</code> folder under any path
                like <code className="text-[#22d3ee] font-mono">customers/name/</code> and PA will
                pick it up. Continuing builds against your personal brain.
              </p>
            </div>
          )}
          {!loadingFolders && folders && folders.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {folders.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => pickFolder(f.path)}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    selectedScope === f.path
                      ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {f.brandColor && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: f.brandColor }}
                      />
                    )}
                    <p className="text-[13px] font-semibold text-slate-100">{f.name}</p>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{f.path}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{f.signals.join(" · ")}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
