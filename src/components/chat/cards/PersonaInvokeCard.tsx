"use client";

import CardShell from "./CardShell";
import { RailIcon } from "../icons";
import type { FilterTag, PersonaInvokePayload } from "@/lib/chat/types";

export default function PersonaInvokeCard({
  payload,
  tag,
  createdAt,
  onArchive,
}: {
  payload: PersonaInvokePayload;
  tag: FilterTag;
  createdAt: string;
  onArchive?: () => void;
}) {
  return (
    <CardShell
      title={payload.personaName}
      accent="#a78bfa"
      icon={<RailIcon iconKey="personas" />}
      tag={tag}
      createdAt={createdAt}
      onArchive={onArchive}
    >
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">You asked</p>
      <p className="text-sm text-slate-300 leading-relaxed">{payload.question}</p>

      {payload.answer ? (
        <>
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mt-3 mb-1">
            {payload.personaName} said
          </p>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{payload.answer}</p>
        </>
      ) : (
        <p className="mt-2.5 text-xs text-slate-500 leading-relaxed">
          Open the full chat to get {payload.personaName}&apos;s answer. Inline answers stream
          here once the v5 Wave B dispatcher is live.
        </p>
      )}

      <a
        href={payload.openHref}
        className="mt-3 inline-block text-[12px] font-mono text-[#a78bfa] hover:underline"
      >
        Open full chat →
      </a>
    </CardShell>
  );
}
