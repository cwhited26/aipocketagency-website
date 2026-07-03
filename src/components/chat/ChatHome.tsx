"use client";

// ChatHome — the chat-as-surface home (PA v5 Wave A). Owns all client state: the message
// window, the active filter (persisted per-user), search, voice capture, and file upload.
// The side rail, input, and search bar are thin; this component is the coordinator. Talks
// to /api/app/chat/* for persistence and reuses lib/chat/search for in-place search/export.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, FilterTag } from "@/lib/chat/types";
import type { SlashAction } from "@/lib/chat/filters";
import { formatAppSlashList, type AppSlashResolution } from "@/lib/apps/slash-commands";
import type { AppId } from "@/lib/apps/catalog";
import type { Tier } from "@/lib/personas/tier-caps";
import { searchMessages, exportToJson, exportToMarkdown, type SearchQuery } from "@/lib/chat/search";
import SideRail from "./SideRail";
import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";
import ChatSearchBar from "./ChatSearchBar";
import VoiceRecorderInline from "./VoiceRecorderInline";

const PAGE_SIZE = 50;

function cacheKey(userId: string): string {
  return `pa_chat_cache_${userId}`;
}

function asc(messages: ChatMessage[]): ChatMessage[] {
  // Server returns newest-first; the UI renders oldest→newest.
  return [...messages].reverse();
}

export default function ChatHome({
  userId,
  tier,
  passApps = [],
  initialMessages,
  initialFilter,
}: {
  userId: string;
  tier: Tier;
  /** Apps unlocked by an active Project Pass rather than the tier (PA-POS-31). */
  passApps?: readonly AppId[];
  initialMessages: ChatMessage[];
  initialFilter: FilterTag;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => asc(initialMessages));
  const [filter, setFilter] = useState<FilterTag>(initialFilter);
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState<SearchQuery>({});
  const [searchAll, setSearchAll] = useState<ChatMessage[] | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const searchActive = Boolean(
    (searchQuery.text && searchQuery.text.trim()) ||
      searchQuery.from ||
      searchQuery.to ||
      (searchQuery.source && searchQuery.source !== "all"),
  );

  // ── Offline cache: hydrate from / persist to localStorage (most recent 50). ──────────
  useEffect(() => {
    if (initialMessages.length === 0 && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(cacheKey(userId));
        if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
      } catch {
        /* corrupt cache → ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(cacheKey(userId), JSON.stringify(messages.slice(-PAGE_SIZE)));
    } catch {
      /* quota / privacy mode → non-fatal */
    }
  }, [messages, userId]);

  // ── Global "/" focuses the input. ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable;
      if (!typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Data fetching. ──────────────────────────────────────────────────────────────────
  const loadFilter = useCallback(async (next: FilterTag) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (next !== "general") params.set("filter", next);
    const res = await fetch(`/api/app/chat/messages?${params.toString()}`);
    if (!res.ok) return;
    const body = (await res.json()) as { messages: ChatMessage[] };
    setMessages(asc(body.messages));
    setHasMore(body.messages.length >= PAGE_SIZE);
  }, []);

  const changeFilter = useCallback(
    (next: FilterTag) => {
      setFilter(next);
      setSearchQuery({});
      setSearchAll(null);
      void loadFilter(next);
      // Persist the choice (fire-and-forget).
      void fetch("/api/app/chat/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: next }),
      });
    },
    [loadFilter],
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].created_at;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), before: oldest });
      if (filter !== "general") params.set("filter", filter);
      const res = await fetch(`/api/app/chat/messages?${params.toString()}`);
      if (res.ok) {
        const body = (await res.json()) as { messages: ChatMessage[] };
        const older = asc(body.messages);
        setMessages((cur) => [...older, ...cur]);
        setHasMore(body.messages.length >= PAGE_SIZE);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, messages, filter]);

  // ── Sending. ────────────────────────────────────────────────────────────────────────
  const send = useCallback(
    async (content: string) => {
      if (sending) return;
      setSending(true);
      // Sending always happens in the home stream; snap back to general so the user sees it.
      if (filter !== "general") {
        setFilter("general");
        void fetch("/api/app/chat/filter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: "general" }),
        });
      }
      try {
        const res = await fetch("/api/app/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const body = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[]; error?: string };
        if (res.ok && body.messages) {
          setMessages((cur) => [...cur, ...body.messages!]);
        } else {
          setMessages((cur) => [
            ...cur,
            {
              id: `local-err-${cur.length}`,
              user_id: userId,
              role: "system",
              content: body.error ?? "Something went wrong sending that message.",
              card_kind: null,
              card_payload: null,
              parent_message_id: null,
              filter_tags: ["general"],
              created_at: new Date().toISOString(),
              archived_at: null,
            },
          ]);
        }
      } finally {
        setSending(false);
      }
    },
    [sending, filter, userId],
  );

  // ── Slash actions from the rail / input. ────────────────────────────────────────────
  const onAction = useCallback(
    (action: SlashAction) => {
      switch (action.kind) {
        case "filter":
          changeFilter(action.filter);
          break;
        case "navigate":
          window.location.href = action.href;
          break;
        case "capture-voice":
          setVoiceOpen(true);
          break;
        case "upload":
          fileInputRef.current?.click();
          break;
      }
    },
    [changeFilter],
  );

  // Append a local-only system message (not persisted) — used for slash-dispatcher feedback.
  const pushSystem = useCallback(
    (content: string) => {
      setMessages((cur) => [
        ...cur,
        {
          id: `local-sys-${cur.length}-${content.length}`,
          user_id: userId,
          role: "system",
          content,
          card_kind: null,
          card_payload: null,
          parent_message_id: null,
          filter_tags: ["general"],
          created_at: new Date().toISOString(),
          archived_at: null,
        },
      ]);
    },
    [userId],
  );

  // ── App slash commands (PA-SLASH-1): `/<app-slug>` opens that App pre-filled. ──────────
  const onAppCommand = useCallback(
    (resolution: AppSlashResolution) => {
      switch (resolution.kind) {
        case "open":
          // The App reads brain context on load; inline args ride along as a prefill param.
          window.location.href = resolution.href;
          break;
        case "locked":
          pushSystem(resolution.reason);
          break;
        case "unknown":
          pushSystem(
            `I don't have an App called /${resolution.attempted}. Try /apps for the list.\n\n${formatAppSlashList(
              resolution.commands,
            )}`,
          );
          break;
        case "help":
          pushSystem(`Apps you can open from here:\n\n${formatAppSlashList(resolution.commands)}`);
          break;
      }
    },
    [pushSystem],
  );

  // ── File upload → persist bytes to the brain + doc_preview card. ──────────────────────
  // The file rides as multipart form-data so the server can run the canonical absorb pipeline
  // (assets/ + memory). The returned card already points at Documents where the asset landed.
  const onFilePicked = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/app/chat/upload", { method: "POST", body: form });
      if (res.ok) {
        const body = (await res.json()) as { card: ChatMessage };
        setMessages((cur) => [...cur, body.card]);
      }
    },
    [],
  );

  // ── Archive. ─────────────────────────────────────────────────────────────────────────
  const onArchive = useCallback((id: string) => {
    setMessages((cur) => cur.filter((m) => m.id !== id));
    void fetch("/api/app/chat/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }, []);

  // ── Search. ──────────────────────────────────────────────────────────────────────────
  // When search activates, lazily pull the full (bounded) history so search covers more than
  // the loaded window.
  useEffect(() => {
    if (searchActive && searchAll === null) {
      void (async () => {
        const res = await fetch(`/api/app/chat/messages?all=1`);
        if (res.ok) {
          const body = (await res.json()) as { messages: ChatMessage[] };
          setSearchAll(asc(body.messages));
        }
      })();
    }
  }, [searchActive, searchAll]);

  const searchResults = useMemo(() => {
    if (!searchActive) return null;
    const corpus = searchAll ?? messages;
    return searchMessages(corpus, searchQuery);
  }, [searchActive, searchAll, messages, searchQuery]);

  const visibleMessages = searchResults ? searchResults.map((r) => r.message) : messages;
  const highlightQuery = searchActive ? searchQuery.text : undefined;

  const onExport = useCallback(
    (format: "json" | "md") => {
      const source = (searchResults ? searchResults.map((r) => r.message) : searchAll ?? messages);
      const text = format === "json" ? exportToJson(source) : exportToMarkdown(source);
      const blob = new Blob([text], { type: format === "json" ? "application/json" : "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pocket-agent-chat-${new Date().toISOString().slice(0, 10)}.${format === "json" ? "json" : "md"}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [searchResults, searchAll, messages],
  );

  return (
    <div className="flex h-screen bg-[#05070a] text-slate-100 overflow-hidden">
      <SideRail activeFilter={filter} onAction={onAction} />

      <div className="flex-1 min-w-0 flex flex-col lg:pt-0 pt-12">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-800/50 px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200 capitalize">
            {filter === "general" ? "Home" : filter}
          </span>
          {filter !== "general" && (
            <span className="text-[10px] font-mono text-slate-600">/{filter}</span>
          )}
        </div>

        <ChatSearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          onExport={onExport}
          resultCount={searchResults ? searchResults.length : null}
          active={searchActive}
          onClear={() => { setSearchQuery({}); setSearchAll(null); }}
        />

        <ChatMessageList
          messages={visibleMessages}
          highlightQuery={highlightQuery}
          hasMore={hasMore && !searchActive}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
          onArchive={onArchive}
          emptyHint={
            searchActive
              ? "No messages match your search."
              : filter === "general"
                ? "Tell Pocket Agent what you want done. Type / to see commands."
                : `Nothing in /${filter} yet.`
          }
        />

        <ChatInput
          inputRef={inputRef}
          tier={tier}
          passApps={passApps}
          onSend={send}
          onSlash={onAction}
          onAppCommand={onAppCommand}
          onMicClick={() => setVoiceOpen(true)}
          disabled={sending}
        />
      </div>

      {voiceOpen && (
        <VoiceRecorderInline
          onSaved={(card) => setMessages((cur) => [...cur, card])}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFilePicked(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
