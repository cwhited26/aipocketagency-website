"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Creates a real project and drops the owner straight into its workspace. A project is a holding
// place: a title, an optional one-line goal, and (set later in the workspace) the instructions,
// reference files, and memory every conversation in the project works inside.
export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, goal: goal.trim() || undefined }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok || !data.project) {
        setError(data.error || "Couldn't create the project. Try again.");
        setSaving(false);
        return;
      }
      router.push(`/app/projects/${data.project.id}`);
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors min-h-[44px] self-start"
      >
        + New project
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
      <input
        autoFocus
        type="text"
        placeholder="Name your project — e.g. Q3 client onboarding"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            create();
          }
        }}
        className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 transition-colors"
      />
      <textarea
        rows={2}
        placeholder="What's the goal? (optional) — one line you can edit later"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 transition-colors resize-none leading-relaxed"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={create}
          disabled={!title.trim() || saving}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
        >
          {saving ? "Creating…" : "Create project →"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg border border-slate-700/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/40 transition-colors min-h-[40px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
