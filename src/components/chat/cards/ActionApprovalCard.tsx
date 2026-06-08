"use client";

// ActionApprovalCard — LIVE (PA v5 Wave B). When a sub-agent stages an external write-action,
// it lands in the owner's Mission Control queue (kind='action_approval'); this inline card
// mirrors it in the chat with the connector/action + preview and a one-tap link to approve.
//
// The inline card payload is schema-scoped to connector/action/preview (no approval id), so the
// actual Approve / Reject / Edit happens in Mission Control, which is one tap away. Nothing
// fires until the owner approves there.

import Link from "next/link";
import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { ActionApprovalPayload, FilterTag } from "@/lib/chat/types";

export default function ActionApprovalCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: ActionApprovalPayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  const connector = payload.connector ?? "connector";
  const action = payload.action ?? "action";
  const preview = payload.preview ?? "";
  return (
    <CardShell
      title={`${connector} · ${action}`}
      accent="#fbbf24"
      icon={<RailIcon iconKey="inbox" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70 mb-1.5">
        Needs your approval
      </p>
      {preview && (
        <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-950/40 rounded-md border border-slate-800/60 px-3 py-2">
          {preview}
        </pre>
      )}

      <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
        Pocket Agent staged this — nothing sends until you approve.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href="/app/mission-control"
          className="rounded-lg bg-[#22d3ee] hover:bg-[#06b6d4] px-3.5 py-1.5 text-xs font-semibold text-[#031820] transition-colors"
        >
          Review &amp; approve
        </Link>
        <span className="text-[10px] font-mono text-slate-500">in Mission Control</span>
      </div>
    </CardShell>
  );
}
