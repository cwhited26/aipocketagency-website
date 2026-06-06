"use client";

// ActionApprovalCard — Wave B PLACEHOLDER. The schema (card_kind='action_approval') is live
// so Wave B can stage real external write-actions (Gmail send, Stripe invoice, etc.) into
// the chat for one-tap approval. In Wave A the Approve / Reject buttons are DISABLED and a
// "Coming with v5 Wave B" badge makes the inert state explicit. No action ever fires here.

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
  const connector = payload.connector ?? "gmail";
  const action = payload.action ?? "send";
  const preview = payload.preview ?? "Subject: Williams Supplement — Inspection findings + scope";
  return (
    <CardShell
      title={`${connector} · ${action}`}
      accent="#fbbf24"
      icon={<RailIcon iconKey="inbox" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
      muted
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
        Action preview
      </p>
      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-950/40 rounded-md border border-slate-800/60 px-3 py-2">
        {preview}
      </pre>

      <div className="mt-3 flex items-center gap-2">
        <button
          disabled
          className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-3.5 py-1.5 text-xs font-medium text-slate-500 cursor-not-allowed"
        >
          Approve
        </button>
        <button
          disabled
          className="rounded-lg border border-slate-700/50 px-3.5 py-1.5 text-xs text-slate-500 cursor-not-allowed"
        >
          Reject
        </button>
        <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-amber-400/70 border border-amber-400/30 rounded px-1.5 py-0.5">
          Coming with v5 Wave B
        </span>
      </div>
    </CardShell>
  );
}
