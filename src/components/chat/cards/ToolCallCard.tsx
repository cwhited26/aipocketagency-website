"use client";

// ToolCallCard — LIVE (PA v5 connector bridge). The chat-send tool-use loop appends one of these
// each time the agent fires a Connection. A read ran inline (status 'ok' / 'error') and shows the
// result preview; a write was staged to the Approval Inbox (status 'staged') and links there.
// This is what replaces the old WAVE_A_REPLY canned text: the agent now visibly uses its tools.

import Link from "next/link";
import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { FilterTag, ToolCallPayload } from "@/lib/chat/types";

const ACCENT: Record<ToolCallPayload["status"], string> = {
  ok: "#22d3ee",
  staged: "#f59e0b",
  error: "#f87171",
};

const STATUS_LABEL: Record<ToolCallPayload["status"], string> = {
  ok: "ran",
  staged: "awaiting approval",
  error: "failed",
};

export default function ToolCallCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: ToolCallPayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  const accent = ACCENT[payload.status];
  return (
    <CardShell
      title={payload.label}
      accent={accent}
      icon={<RailIcon iconKey="connections" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5 border"
          style={{ color: accent, borderColor: `${accent}66` }}
        >
          {STATUS_LABEL[payload.status]}
        </span>
        <code className="text-[10px] font-mono text-slate-500 truncate">{payload.tool}</code>
      </div>

      <p className="mt-2 text-sm text-slate-200">{payload.summary}</p>

      {payload.detail && (
        <pre className="mt-2.5 max-h-64 overflow-auto rounded-lg border border-slate-800/60 bg-[#0b1016] px-3 py-2 text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap">
          {payload.detail}
        </pre>
      )}

      {payload.openHref && (
        <Link
          href={payload.openHref}
          className="mt-2.5 inline-block text-[11px] font-mono transition-colors hover:underline"
          style={{ color: accent }}
        >
          {payload.status === "staged" ? "Review in Inbox →" : "Open →"}
        </Link>
      )}
    </CardShell>
  );
}
