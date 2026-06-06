"use client";

import CardShell from "./CardShell";
import { MicIcon } from "../icons";
import type { FilterTag, VoiceMemoPayload } from "@/lib/chat/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceMemoCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: VoiceMemoPayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  return (
    <CardShell
      title="Voice memo"
      accent="#f87171"
      icon={<MicIcon />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 mb-1.5">
        <span className="text-red-300">●</span>
        <span className="tabular-nums">{formatDuration(payload.durationSeconds)}</span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
        {payload.transcriptSnippet}
      </p>
      <a
        href={payload.openHref ?? "/app/brain/inbox"}
        className="mt-2.5 inline-block text-[12px] font-mono text-[#f87171] hover:underline"
      >
        Open full transcript →
      </a>
    </CardShell>
  );
}
