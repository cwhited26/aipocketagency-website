"use client";

// MessageBubble — renders one chat row by role: user (right), assistant (left), system
// (centered, muted), or an inline card (full width via the card dispatcher). Optional
// highlightQuery underlines substring matches in plain text for in-place search results.

import { findMatches } from "@/lib/chat/search";
import type { ChatMessage } from "@/lib/chat/types";
import InlineCard from "./cards";

function Highlighted({ text, query }: { text: string; query?: string }) {
  const ranges = query ? findMatches(text, query) : [];
  if (ranges.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(text.slice(cursor, r.start));
    out.push(
      <mark key={i} className="bg-[#22d3ee]/25 text-[#9fe9f7] rounded px-0.5">
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

export default function MessageBubble({
  message,
  highlightQuery,
  onArchive,
}: {
  message: ChatMessage;
  highlightQuery?: string;
  onArchive?: (id: string) => void;
}) {
  if (message.role === "inline_card") {
    return (
      <div className="w-full max-w-2xl">
        <InlineCard message={message} onArchive={onArchive} />
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="w-full flex justify-center">
        <p className="text-[11px] font-mono text-slate-600 italic px-3 py-1">
          <Highlighted text={message.content} query={highlightQuery} />
        </p>
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#22d3ee]/12 border border-[#22d3ee]/25 text-slate-100"
            : "bg-slate-900/60 border border-slate-800/60 text-slate-200"
        }`}
      >
        <Highlighted text={message.content} query={highlightQuery} />
      </div>
    </div>
  );
}
