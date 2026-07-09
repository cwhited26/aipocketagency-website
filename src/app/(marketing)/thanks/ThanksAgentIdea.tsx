"use client";

// The carried agent idea, read back after Stripe returns (agent-builder intent carry,
// PA-POS-28/34). A pay-first buyer typed this into the Agent Builder before the paywall —
// show it here so the first post-payment screen picks up exactly where they left off. The
// CTA carries the spec in the URL too, so the prefill works even if the login link opens
// somewhere the captured copy can't reach.

import { useEffect, useState } from "react";
import Link from "next/link";
import { readAgentIdea } from "@/lib/marketing/agent-idea-store";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export default function ThanksAgentIdea() {
  const [idea, setIdea] = useState("");

  // Post-mount read keeps the page server-renderable — no storage on the server.
  useEffect(() => {
    setIdea(readAgentIdea());
  }, []);

  if (!idea) return null;

  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 text-left">
      <div
        className="text-xs uppercase tracking-wider text-cyan-300/70"
        style={{ fontFamily: MONO_FONT }}
      >
        your first agent
      </div>
      <p
        className="mt-2 text-sm leading-relaxed text-slate-200"
        style={{ fontFamily: MONO_FONT }}
      >
        &ldquo;{idea}&rdquo;
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
        Your workspace is ready to compose this. It stages in Mission Control for your
        approval — nothing runs until you say so.
      </p>
      <Link
        href={`/app/agents?spec=${encodeURIComponent(idea)}#compose`}
        className="mt-4 inline-block rounded-lg border border-cyan-300/40 bg-cyan-300/[0.06] px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-300/[0.12]"
      >
        Compose my agent →
      </Link>
    </div>
  );
}
