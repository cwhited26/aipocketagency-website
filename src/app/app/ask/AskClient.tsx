"use client";

import { useState, useRef, useTransition } from "react";

type Citation = { file: string; line: string };
type AskResponse = { answer: string; citations: Citation[] };

export default function AskClient({ brainRepo }: { brainRepo: string }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const q = question.trim();
    if (!q || isPending) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await fetch("/api/app/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Something went wrong. Try again.");
        return;
      }
      const data = (await res.json()) as AskResponse;
      setResult(data);
    });
  }

  return (
    <div className="min-h-screen bg-[#05070a] flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
        <div>
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase mb-1">
            {brainRepo}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Ask your brain</h1>
          <p className="text-slate-500 text-sm mt-1">
            Answers sourced strictly from your memory files.
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            rows={4}
            placeholder="What did I decide about BOS pricing? What are my goals for this quarter?"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">⌘↵ to submit</span>
            <button
              onClick={submit}
              disabled={!question.trim() || isPending}
              className="rounded-lg bg-[#22d3ee] px-5 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Thinking…" : "Ask"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {isPending && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span className="animate-pulse">Scanning memory files…</span>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-5">
              <div className="text-xs text-slate-500 font-mono mb-3">answer</div>
              <div className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </div>
            </div>

            {result.citations.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
                <div className="text-xs text-slate-500 font-mono mb-2">sources</div>
                <ul className="space-y-1">
                  {result.citations.map((c, i) => (
                    <li key={i} className="text-xs font-mono text-[#22d3ee]/80">
                      {c.file}
                      {c.line ? `:${c.line}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
