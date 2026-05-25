"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

type GhRepo = { full_name: string; private: boolean };

const RepoSchema = z
  .string()
  .min(1, "Enter a repo.")
  .regex(
    /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
    "Use owner/name format, e.g. yourname/my-brain",
  );

const RepoNameSchema = z
  .string()
  .min(1, "Enter a repo name.")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/,
    "Start with a letter or number; only letters, numbers, dashes, underscores, or dots.",
  );

type Phase = "idle" | "confirm" | "connect" | "fork" | "done";

type Props = {
  currentRepo: string | null;
  hasGitHub: boolean;
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400 leading-relaxed">
      {message}
    </div>
  );
}

export default function BrainRepoPanel({ currentRepo, hasGitHub }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [repoMode, setRepoMode] = useState<"dropdown" | "manual">("manual");
  const [repoInput, setRepoInput] = useState("");
  const [repoName, setRepoName] = useState("my-pocket-brain");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRepo, setNewRepo] = useState("");

  // Fetch repos when entering connect phase
  useEffect(() => {
    if (phase !== "connect") return;
    let active = true;
    setRepoInput("");
    setError(null);
    fetch("/api/app/github/repos")
      .then((r) => (r.ok ? (r.json() as Promise<GhRepo[]>) : Promise.reject()))
      .then((data) => {
        if (!active) return;
        setRepos(data);
        setRepoMode(data.length > 0 ? "dropdown" : "manual");
      })
      .catch(() => {
        if (!active) return;
        setRepos([]);
        setRepoMode("manual");
      });
    return () => {
      active = false;
    };
  }, [phase]);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setSaving(false);
    setRepoInput("");
    setRepoName("my-pocket-brain");
    setRepos([]);
    setRepoMode("manual");
    setNewRepo("");
  }, []);

  async function handleConnectExisting() {
    const parsed = RepoSchema.safeParse(repoInput.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid format.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/app/connect-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: parsed.data }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        repo?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Failed to connect repo. Try again.");
        return;
      }
      setNewRepo(parsed.data);
      setPhase("done");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleForkNew() {
    const parsed = RepoNameSchema.safeParse(repoName.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/app/onboarding/fork-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: parsed.data }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        repo?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Failed to create repo. Try again.");
        return;
      }
      setNewRepo(body.repo ?? parsed.data);
      setPhase("done");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDone() {
    router.refresh();
    reset();
  }

  // ─── idle ──────────────────────────────────────────────────────────────────

  if (phase === "idle") {
    return (
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-sm text-slate-400">Brain repo</span>
          {currentRepo ? (
            <p className="text-xs font-mono text-[#22d3ee]/80 mt-0.5 break-all leading-snug">
              {currentRepo}
            </p>
          ) : (
            <p className="text-sm text-slate-500 mt-0.5">Not connected</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPhase("confirm")}
          className="shrink-0 min-h-[44px] min-w-[56px] text-xs font-medium text-slate-400 hover:text-[#22d3ee] border border-slate-700/60 hover:border-[#22d3ee]/40 rounded-lg px-3 py-2 transition-colors"
        >
          {currentRepo ? "Change" : "Connect"}
        </button>
      </div>
    );
  }

  // ─── confirm ───────────────────────────────────────────────────────────────

  if (phase === "confirm") {
    return (
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-slate-400">Brain repo</span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 text-xs text-slate-500 hover:text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-end transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-slate-200">
            Your current repo is NOT deleted.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {currentRepo ? (
              <>
                <span className="font-mono text-slate-300">{currentRepo}</span> stays on GitHub
                exactly as it is — memory, files, everything.
              </>
            ) : (
              "Nothing will be overwritten or deleted."
            )}{" "}
            After switching, your agent reads and writes the new repo going forward.
          </p>
        </div>

        <div className="space-y-2.5">
          <p className="text-[11px] font-mono text-[#22d3ee]/50 tracking-[0.15em] uppercase">
            How do you want to switch?
          </p>

          {!hasGitHub && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-300 font-medium">GitHub not connected</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Go to the GitHub row above and connect first, then come back here.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPhase("connect")}
            disabled={!hasGitHub}
            className="w-full min-h-[52px] rounded-lg border border-slate-700/60 bg-slate-800/40 hover:border-[#22d3ee]/40 hover:bg-slate-800/70 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-left transition-colors"
          >
            <p className="text-sm font-semibold text-slate-100">
              Connect a repo I already have
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Point the agent at an existing GitHub repo you own
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPhase("fork")}
            disabled={!hasGitHub}
            className="w-full min-h-[52px] rounded-lg border border-slate-700/60 bg-slate-800/40 hover:border-[#22d3ee]/40 hover:bg-slate-800/70 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-left transition-colors"
          >
            <p className="text-sm font-semibold text-slate-100">
              Create a fresh brain from the template
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Forks the Pocket Agent brain template as a new private repo
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ─── connect existing ──────────────────────────────────────────────────────

  if (phase === "connect") {
    return (
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => { setPhase("confirm"); setError(null); }}
              className="text-xs text-slate-500 hover:text-slate-300 underline min-h-[44px] flex items-center transition-colors"
            >
              ← Back
            </button>
            <p className="text-[11px] font-mono text-[#22d3ee]/50 tracking-[0.15em] uppercase mt-1">
              Connect existing repo
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 text-xs text-slate-500 hover:text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-end transition-colors"
          >
            Cancel
          </button>
        </div>

        {repos.length > 0 && repoMode === "dropdown" ? (
          <div className="space-y-2">
            <label className="text-xs text-slate-300 font-medium">Choose a repo</label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-[#22d3ee] focus:outline-none min-h-[44px]"
              value={repoInput}
              onChange={(e) => { setRepoInput(e.target.value); setError(null); }}
            >
              <option value="">— Select a repo —</option>
              {repos.map((r) => (
                <option key={r.full_name} value={r.full_name}>
                  {r.full_name}{r.private ? " 🔒" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setRepoMode("manual"); setRepoInput(""); }}
              className="text-xs text-slate-600 hover:text-slate-400 underline"
            >
              Type a repo name instead
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-slate-300 font-medium">
              Brain repo{" "}
              <span className="text-slate-600 font-normal font-mono">owner/name</span>
            </label>
            <input
              type="text"
              placeholder="yourname/my-brain"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none min-h-[44px]"
              value={repoInput}
              onChange={(e) => { setRepoInput(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleConnectExisting(); }}
              disabled={saving}
            />
            {repos.length > 0 && (
              <button
                type="button"
                onClick={() => { setRepoMode("dropdown"); setRepoInput(""); }}
                className="text-xs text-slate-600 hover:text-slate-400 underline"
              >
                Pick from my repos instead
              </button>
            )}
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <button
          type="button"
          onClick={handleConnectExisting}
          disabled={saving || !repoInput.trim()}
          className="w-full min-h-[48px] rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Connecting…" : "Connect brain →"}
        </button>
      </div>
    );
  }

  // ─── fork new ─────────────────────────────────────────────────────────────

  if (phase === "fork") {
    return (
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => { setPhase("confirm"); setError(null); }}
              className="text-xs text-slate-500 hover:text-slate-300 underline min-h-[44px] flex items-center transition-colors"
            >
              ← Back
            </button>
            <p className="text-[11px] font-mono text-[#22d3ee]/50 tracking-[0.15em] uppercase mt-1">
              Fork fresh brain
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 text-xs text-slate-500 hover:text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-end transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Creates a private repo in your GitHub account from the Pocket Agent brain template.
          Your old repo is left untouched.
        </p>

        <div className="space-y-2">
          <label className="text-xs text-slate-300 font-medium">Name your new brain repo</label>
          <input
            type="text"
            placeholder="my-pocket-brain"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none min-h-[44px]"
            value={repoName}
            onChange={(e) => { setRepoName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleForkNew(); }}
            disabled={saving}
          />
          <p className="text-[11px] text-slate-600">
            Created as a private repo. You own it — not locked to this platform.
          </p>
        </div>

        {error && <ErrorBanner message={error} />}

        <button
          type="button"
          onClick={handleForkNew}
          disabled={saving || !repoName.trim()}
          className="w-full min-h-[48px] rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Forging…" : "Forge my brain →"}
        </button>
      </div>
    );
  }

  // ─── done ──────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#22d3ee]/20 border border-[#22d3ee]/40 shrink-0">
            <svg className="w-3 h-3 text-[#22d3ee]" fill="none" viewBox="0 0 10 10">
              <path
                d="M1.5 5l2.5 2.5 4.5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-sm font-semibold text-slate-100">Brain repo switched</p>
        </div>
        <p className="text-xs font-mono text-[#22d3ee]/70 break-all">{newRepo}</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your agent will read and write this repo going forward. The old repo is untouched on
          GitHub.
        </p>
        <button
          type="button"
          onClick={handleDone}
          className="w-full min-h-[48px] rounded-lg border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/70 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return null;
}
