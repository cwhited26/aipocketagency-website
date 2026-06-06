"use client";

import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { FilterTag, MemoryWritePayload } from "@/lib/chat/types";

export default function MemoryWriteCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: MemoryWritePayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  return (
    <CardShell
      title="Saved to your brain"
      icon={<RailIcon iconKey="brain" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{payload.summary}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {payload.tier && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#22d3ee] border border-[#22d3ee]/30 rounded px-1.5 py-0.5">
            {payload.tier}
          </span>
        )}
        <a
          href="/app/documents"
          className="text-[11px] font-mono text-slate-500 hover:text-[#22d3ee] transition-colors break-all"
        >
          → {payload.path}
        </a>
        {payload.sha && (
          <span className="text-[10px] font-mono text-slate-600">{payload.sha.slice(0, 7)}</span>
        )}
      </div>
    </CardShell>
  );
}
