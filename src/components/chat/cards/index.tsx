"use client";

// index.tsx — the inline-card dispatcher. Given a persisted chat message of role
// 'inline_card', it safe-parses card_payload against the kind's Zod schema and renders the
// matching card. A payload that fails validation degrades to a minimal fallback rather than
// crashing the whole history (defense against a drifted / partially-written row).

import {
  CARD_PAYLOAD_SCHEMAS,
  type ChatMessage,
  type FilterTag,
  type MemoryWritePayload,
  type PersonaInvokePayload,
  type DocPreviewPayload,
  type VoiceMemoPayload,
  type ScreenshotPayload,
  type SubAgentActivityPayload,
  type ActionApprovalPayload,
  type PersonaResponsePayload,
} from "@/lib/chat/types";
import CardShell from "./CardShell";
import MemoryWriteCard from "./MemoryWriteCard";
import PersonaInvokeCard from "./PersonaInvokeCard";
import DocPreviewCard from "./DocPreviewCard";
import VoiceMemoCard from "./VoiceMemoCard";
import ScreenshotCard from "./ScreenshotCard";
import SubAgentActivityCard from "./SubAgentActivityCard";
import ActionApprovalCard from "./ActionApprovalCard";
import { RailIcon } from "../icons";

function primaryTag(tags: readonly FilterTag[]): FilterTag {
  // The first non-general tag reads best on the chip; fall back to general.
  return tags.find((t) => t !== "general") ?? tags[0] ?? "general";
}

export default function InlineCard({
  message,
  onArchive,
}: {
  message: ChatMessage;
  onArchive?: (id: string) => void;
}) {
  const kind = message.card_kind;
  if (!kind) return null;

  const schema = CARD_PAYLOAD_SCHEMAS[kind];
  const parsed = schema.safeParse(message.card_payload);
  const tag = primaryTag(message.filter_tags);
  const archive = onArchive ? () => onArchive(message.id) : undefined;

  if (!parsed.success) {
    return (
      <CardShell
        title="Card unavailable"
        icon={<RailIcon iconKey="agent" />}
        tag={tag}
        createdAt={message.created_at}
        onArchive={archive}
        muted
      >
        <p className="text-xs text-slate-500">
          This card couldn&apos;t be displayed (its data didn&apos;t match the expected
          format).
        </p>
      </CardShell>
    );
  }

  const data = parsed.data;
  switch (kind) {
    case "memory_write":
      return <MemoryWriteCard payload={data as MemoryWritePayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "persona_invoke":
      return <PersonaInvokeCard payload={data as PersonaInvokePayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "doc_preview":
      return <DocPreviewCard payload={data as DocPreviewPayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "voice_memo":
      return <VoiceMemoCard payload={data as VoiceMemoPayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "screenshot":
      return <ScreenshotCard payload={data as ScreenshotPayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "sub_agent_activity":
      return <SubAgentActivityCard payload={data as SubAgentActivityPayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "action_approval":
      return <ActionApprovalCard payload={data as ActionApprovalPayload} tag={tag} createdAt={message.created_at} onArchive={archive} />;
    case "persona_response": {
      const p = data as PersonaResponsePayload;
      return (
        <CardShell
          title={p.personaName}
          accent="#a78bfa"
          icon={<RailIcon iconKey="personas" />}
          tag={tag}
          createdAt={message.created_at}
          onArchive={archive}
        >
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{p.answer}</p>
          {p.openHref && (
            <a href={p.openHref} className="mt-2.5 inline-block text-[12px] font-mono text-[#a78bfa] hover:underline">
              Open full chat →
            </a>
          )}
        </CardShell>
      );
    }
    default: {
      // Exhaustiveness guard — a new card kind without a branch fails the type-check here.
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
