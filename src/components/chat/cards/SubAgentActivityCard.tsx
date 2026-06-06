"use client";

// SubAgentActivityCard — Wave B PLACEHOLDER. The schema (card_kind='sub_agent_activity')
// and payload contract are live so Wave B's dispatcher can stream real sub-agent phase
// progress into the chat without a migration. Until then this renders a faded preview of
// the 7-phase Algorithm and a "coming soon" note. No real runtime in Wave A.

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
  const activePhase = payload.phase ?? "plan";
  return (
    <CardShell
      title={payload.label ?? "Sub-agent activity"}
      accent="#64748b"
      icon={<RailIcon iconKey="agent" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
      muted
    >
      <p className="text-sm text-slate-400">Sub-agent activity (Wave B feature, coming soon)</p>

      {/* Faded 7-phase preview */}
      <div className="mt-3 flex flex-wrap gap-1.5 opacity-50 pointer-events-none select-none">
        {PHASES.map((p) => (
          <span
            key={p}
            className={`text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5 border ${
              p === activePhase
                ? "border-[#22d3ee]/40 text-[#22d3ee]"
                : "border-slate-800 text-slate-600"
            }`}
          >
            {p}
          </span>
        ))}
      </div>

      {payload.note && <p className="mt-2 text-xs text-slate-600 italic">{payload.note}</p>}

      <span className="mt-3 inline-block text-[9px] font-mono uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
        Coming with v5 Wave B
      </span>
    </CardShell>
  );
}
