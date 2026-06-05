"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function PersonaChatClient({
  personaId,
  personaName,
  token,
}: {
  personaId: string;
  personaName: string;
  token: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const conversationId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setSending(true);
    scrollToBottom();

    const appendToAssistant = (chunk: string) =>
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: last.content + chunk };
        return next;
      });
    const setAssistant = (content: string) =>
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") next[next.length - 1] = { ...last, content };
        return next;
      });

    try {
      const res = await fetch(`/api/personas/${personaId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: text, conversationId: conversationId.current ?? undefined }),
      });

      const ctype = res.headers.get("content-type") ?? "";
      if (!ctype.includes("text/event-stream")) {
        const body = (await res.json().catch(() => ({}))) as { assistant?: string; error?: string };
        setAssistant(body.assistant ?? body.error ?? "Something went wrong.");
        setSending(false);
        scrollToBottom();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          try {
            const evt = JSON.parse(payload) as {
              type: string;
              text?: string;
              conversationId?: string;
              error?: string;
            };
            if (evt.type === "meta" && evt.conversationId) conversationId.current = evt.conversationId;
            else if (evt.type === "delta" && evt.text) appendToAssistant(evt.text);
            else if (evt.type === "error") appendToAssistant(`\n\n[${evt.error ?? "error"}]`);
          } catch {
            /* ignore malformed line */
          }
          scrollToBottom();
        }
      }
    } catch {
      setAssistant("Sorry — I couldn't reach the assistant. Try again.");
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#05070a] text-slate-100">
      <header className="h-14 shrink-0 flex items-center px-5 border-b border-slate-800/60">
        <span className="font-medium text-slate-100">{personaName}</span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 text-sm mt-16">
              <p className="text-slate-300">Hi, I&apos;m {personaName}.</p>
              <p className="mt-1">What can I help you with?</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#22d3ee] text-[#06222a]"
                    : "bg-slate-800/70 text-slate-100"
                }`}
              >
                {m.content || (m.role === "assistant" && sending ? "…" : "")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-800/60 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message ${personaName}…`}
            className="flex-1 resize-none rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#22d3ee] max-h-32"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </div>
        <p className="max-w-2xl mx-auto text-[10px] text-slate-600 mt-2 text-center">
          This chat is processed by AI. Conversations may be logged. Built with Pocket Agent.
        </p>
      </div>
    </div>
  );
}
