"use client";

// ChatMessageList — the scrollable history above the input. Autoscrolls to the newest
// message when the tail changes and the user is near the bottom; offers a "load older"
// affordance at the top for pagination (preserving scroll position across the prepend).

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat/types";
import MessageBubble from "./MessageBubble";

export default function ChatMessageList({
  messages,
  highlightQuery,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onArchive,
  emptyHint,
}: {
  messages: ChatMessage[];
  highlightQuery?: string;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onArchive?: (id: string) => void;
  emptyHint?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastId = messages[messages.length - 1]?.id;
  const prevHeightRef = useRef(0);
  const prependingRef = useRef(false);

  // Autoscroll to newest when the tail changes (skip when we just prepended older rows).
  useEffect(() => {
    if (prependingRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [lastId]);

  // Preserve viewport position when older messages are prepended.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el && prependingRef.current) {
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
      prependingRef.current = false;
    }
  }, [messages.length]);

  const handleLoadOlder = () => {
    const el = containerRef.current;
    if (el) {
      prevHeightRef.current = el.scrollHeight;
      prependingRef.current = true;
    }
    onLoadOlder();
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="text-[11px] font-mono text-slate-500 hover:text-[#22d3ee] border border-slate-800 rounded-full px-3 py-1 transition-colors disabled:opacity-50"
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-500">{emptyHint ?? "No messages yet."}</p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} highlightQuery={highlightQuery} onArchive={onArchive} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
