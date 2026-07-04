"use client";

// The Clone CTA on a library card at /app/agents (PA-POS-37). Same button slot the marketing
// card fills with a signup link — in the workspace, clicking runs the REAL compose flow with
// the card's workflow as the spec (libraryAgentSpec), so a clone stages the same one approval
// card in Mission Control as a free-form compose. Nothing deploys until the owner approves it.

import { useState } from "react";
import Link from "next/link";
import { libraryAgentSpec, type LibraryAgent } from "@/data/agents-library";

type ClonePhase =
  | { kind: "idle" }
  | { kind: "composing" }
  | { kind: "staged" }
  | { kind: "error"; message: string };

type ComposeResponse = { error?: string; suggestion?: string };

export function CloneAgentButton({ agent }: { agent: LibraryAgent }) {
  const [phase, setPhase] = useState<ClonePhase>({ kind: "idle" });

  async function clone() {
    if (phase.kind === "composing") return;
    setPhase({ kind: "composing" });
    try {
      const res = await fetch("/api/app/agent-builder/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: libraryAgentSpec(agent) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ComposeResponse;
        setPhase({
          kind: "error",
          message:
            [body.error, body.suggestion].filter(Boolean).join(" ") ||
            "Cloning failed. Try again.",
        });
        return;
      }
      setPhase({ kind: "staged" });
    } catch {
      setPhase({ kind: "error", message: "Cloning failed. Check your connection and try again." });
    }
  }

  if (phase.kind === "staged") {
    return (
      <Link
        href="/app/mission-control"
        className="shrink-0 rounded-lg border border-accent/40 bg-accent/[0.06] px-3.5 py-2 text-[13px] font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12]"
      >
        Staged — review it →
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button
        type="button"
        data-clone-agent={agent.slug}
        onClick={clone}
        disabled={phase.kind === "composing"}
        className="rounded-lg border border-accent/40 bg-accent/[0.06] px-3.5 py-2 text-[13px] font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12] disabled:opacity-60"
      >
        {phase.kind === "composing" ? "Composing…" : "Clone this agent →"}
      </button>
      {phase.kind === "error" && (
        <p className="max-w-[16rem] text-right text-[11px] leading-snug text-red-400">
          {phase.message}
        </p>
      )}
    </div>
  );
}
