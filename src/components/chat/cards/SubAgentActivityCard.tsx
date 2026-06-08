"use client";

// SubAgentActivityCard — LIVE (PA v5 Wave B). When the orchestrator dispatches a run, the chat
// send route appends one of these with the plan label + current phase. It renders the 7-phase
// Algorithm with the active phase lit, plus a link into the Tasks / Mission Control surfaces where live
// progress + approvals land. (The inline card is schema-scoped to label/phase/note — the live,
// per-run timeline lives at /app/mission-control via the orchestrator run API.)

import Link from "next/link";
import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { FilterTag, SubAgentActivityPayload } from "@/lib/chat/types";

const PHASES = ["observe", "think", "plan", "build", "execute", "verify", "learn"] as const;

export default function SubAgentActivityCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: SubAgentActivityPayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  const activePhase = payload.phase ?? "observe";
  return (
    <CardShell
      title={payload.label ?? "Sub-agent run"}
      accent="#22d3ee"
      icon={<RailIcon iconKey="agent" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <p className="text-sm text-slate-300">{payload.note ?? "On it — running the task."}</p>

      {/* Live 7-phase Algorithm strip */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PHASES.map((p) => (
          <span
            key={p}
            className={`text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5 border ${
              p === activePhase
                ? "border-[#22d3ee]/60 text-[#22d3ee] bg-[#22d3ee]/10"
                : "border-slate-800 text-slate-600"
            }`}
          >
            {p}
          </span>
        ))}
      </div>

      <Link
        href="/app/mission-control"
        className="mt-3 inline-block text-[11px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
      >
        Track progress + approvals →
      </Link>
    </CardShell>
  );
}
