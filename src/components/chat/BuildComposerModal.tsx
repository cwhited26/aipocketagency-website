"use client";

// BuildComposerModal — the `/build` inline composer (PA-POS-34). Describing a new agent never
// means leaving the conversation: the owner types the spec here, Pocket Agent composes it, and
// the agent_builder_proposal card fires into Mission Control exactly as if they'd come in
// through /agents#compose. Every tier — the tier gate applies to the composed spec's Apps at
// review time, priced on the card, never a block. Success renders in the modal itself, so the
// flow works the same from the chat home, a Persona conversation, or the landing.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ComposeResponse = {
  personaName?: string;
  gatedAppsNote?: string;
  error?: string;
  suggestion?: string;
};

export default function BuildComposerModal({
  initialSpec,
  onClose,
}: {
  /** Inline args from `/build <spec>` — prefills the textarea. */
  initialSpec: string;
  onClose: () => void;
}) {
  const [spec, setSpec] = useState(initialSpec);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [staged, setStaged] = useState<{ personaName: string; gatedAppsNote: string } | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function compose() {
    const trimmed = spec.trim();
    if (trimmed.length < 12) {
      setErr("Describe the agent in at least a sentence.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/app/agent-builder/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as ComposeResponse;
      if (!res.ok) {
        setErr(
          [body.error, body.suggestion].filter(Boolean).join(" ") ||
            "Composing failed. Try again.",
        );
        return;
      }
      setStaged({
        personaName: body.personaName ?? "Your agent",
        gatedAppsNote: body.gatedAppsNote ?? "",
      });
    } catch {
      setErr("Composing failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compose an agent"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#22d3ee]/25 bg-[#0a1017] p-5 shadow-2xl">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#22d3ee]/70">
          /build · compose an agent
        </p>

        {staged ? (
          <>
            <p className="mt-3 text-[15px] font-semibold leading-snug text-slate-100">
              Composed. {staged.personaName} is staged in Mission Control.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Read the whole agent on one card — the Persona, the Apps it runs, the Skills it
              starts with, the brain zones it may read. Nothing runs until you approve it.
            </p>
            {staged.gatedAppsNote && (
              <p className="mt-2 text-sm leading-relaxed text-amber-200/80">
                {staged.gatedAppsNote}
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] rounded-xl px-4 text-sm text-slate-500 transition-colors hover:text-slate-300"
              >
                Back to the conversation
              </button>
              <Link
                href="/app/mission-control"
                className="flex min-h-[40px] items-center rounded-xl bg-[#22d3ee] px-5 text-sm font-semibold text-[#031820] transition-colors hover:bg-[#06b6d4]"
              >
                Review it
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Describe the agent you need — Pocket Agent composes it from your Personas, Apps,
              and Skills and stages one approval card in Mission Control. Nothing runs until
              you say so.
            </p>
            <textarea
              ref={textareaRef}
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              rows={4}
              maxLength={4_000}
              placeholder="An agent that watches Gmail for adjuster emails and drafts SRA responses in my voice."
              aria-label="Describe the agent you need"
              disabled={busy}
              className="mt-3 w-full resize-none rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 outline-none focus:border-[#22d3ee]/40 disabled:opacity-60"
            />
            {err && <p className="mt-2 text-xs font-mono text-red-400">{err}</p>}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-[40px] rounded-xl px-4 text-sm text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={compose}
                disabled={busy || spec.trim().length === 0}
                className="min-h-[40px] rounded-xl bg-[#22d3ee] px-5 text-sm font-semibold text-[#031820] transition-colors hover:bg-[#06b6d4] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Composing…" : "Compose"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
