"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Brain "Add to memory" affordance — a prominent button that opens a small modal: pick a
// category, type the fact, save. On save it hands the fact to the agent (/app/ask?q=…), which
// files it into the right place in your brain and stages the change for your approval. Categories
// mirror PA's memory shape (and the same tiles shown on the Brain page).
const CATEGORIES = [
  "About your business",
  "Who you serve",
  "How you work",
  "Current projects",
  "Key decisions",
  "Tools & stack",
] as const;

export function AddMemoryButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [text, setText] = useState("");

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const prompt = `Add this to my brain under "${category}": ${trimmed}`;
    router.push(`/app/ask?q=${encodeURIComponent(prompt)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors min-h-[40px]"
      >
        <span className="text-base font-bold leading-none">+</span>
        Add to memory
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700/70 bg-[#0b1017] p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-100">Teach your agent something</h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Add a fact about your business and it sticks — your agent uses it on every reply from
              here on.
            </p>

            <label className="mt-4 block text-[11px] font-mono text-slate-500 uppercase tracking-[0.14em]">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 focus:border-[#22d3ee]/50 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-[11px] font-mono text-slate-500 uppercase tracking-[0.14em]">
              What should it remember?
            </label>
            <textarea
              rows={4}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. We only take jobs within a 40-mile radius of the shop."
              className="mt-1.5 w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#22d3ee]/50 focus:outline-none resize-none leading-relaxed"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/60 transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!text.trim()}
                className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
              >
                Save memory
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
