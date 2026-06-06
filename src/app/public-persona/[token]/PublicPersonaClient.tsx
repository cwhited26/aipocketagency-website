"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Lead = { name: string; email: string; phone: string };

export default function PublicPersonaClient({
  personaId,
  personaName,
  token,
  greeting,
  badgeRemoved,
  leadCaptureEnabled,
  embed,
}: {
  personaId: string;
  personaName: string;
  token: string;
  greeting: string;
  badgeRemoved: boolean;
  leadCaptureEnabled: boolean;
  embed: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // The pre-chat form gates the chat until completed (when enabled).
  const [formDone, setFormDone] = useState(!leadCaptureEnabled);
  const [lead, setLead] = useState<Lead>({ name: "", email: "", phone: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const sessionId = useRef<string>("");
  const leadSent = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stable per-visitor session id (drives the per-session/day rate limit window).
  useEffect(() => {
    const key = `pa-persona-session-${token}`;
    let sid = "";
    try {
      sid = localStorage.getItem(key) ?? "";
      if (!sid) {
        sid =
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `s-${Math.abs(hashString(token + String(Date.now())))}`);
        localStorage.setItem(key, sid);
      }
    } catch {
      sid = `s-${Math.abs(hashString(token))}`;
    }
    sessionId.current = sid;
  }, [token]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function submitForm() {
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(lead.email)) {
      setFormErr("Please enter a valid email.");
      return;
    }
    setFormErr(null);
    setFormDone(true);
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

    // Send the pre-chat lead alongside the first message only.
    const includeLead = leadCaptureEnabled && !leadSent.current;
    const body: Record<string, unknown> = {
      token,
      message: text,
      conversationId: conversationId.current ?? undefined,
      sessionId: sessionId.current || undefined,
    };
    if (includeLead) {
      body.lead = { email: lead.email, name: lead.name || undefined, phone: lead.phone || undefined };
      leadSent.current = true;
    }

    try {
      const res = await fetch(`/api/personas/${personaId}/public-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const ctype = res.headers.get("content-type") ?? "";
      if (!ctype.includes("text/event-stream")) {
        const json = (await res.json().catch(() => ({}))) as {
          assistant?: string;
          error?: string;
          conversationId?: string;
        };
        if (json.conversationId) conversationId.current = json.conversationId;
        setAssistant(json.assistant ?? json.error ?? "Something went wrong.");
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

  const wrap = embed ? "h-screen" : "min-h-screen";

  if (!formDone) {
    return (
      <div className={`${wrap} flex flex-col bg-[#05070a] text-slate-100`}>
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="w-full max-w-sm">
            <h1 className="text-lg font-semibold text-slate-100">Chat with {personaName}</h1>
            <p className="text-sm text-slate-500 mt-1">{greeting}</p>
            <div className="mt-5 space-y-3">
              <Field label="Name" value={lead.name} onChange={(v) => setLead((l) => ({ ...l, name: v }))} placeholder="Your name (optional)" />
              <Field label="Email" value={lead.email} onChange={(v) => setLead((l) => ({ ...l, email: v }))} placeholder="you@email.com" required />
              <Field label="Phone" value={lead.phone} onChange={(v) => setLead((l) => ({ ...l, phone: v }))} placeholder="Phone (optional)" />
              {formErr && <p className="text-sm text-red-300">{formErr}</p>}
              <button
                onClick={submitForm}
                className="w-full rounded-xl bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
              >
                Start chatting
              </button>
            </div>
          </div>
        </div>
        {!badgeRemoved && <PoweredBy />}
      </div>
    );
  }

  return (
    <div className={`${wrap} flex flex-col bg-[#05070a] text-slate-100`}>
      <header className="h-14 shrink-0 flex items-center px-5 border-b border-slate-800/60">
        <span className="font-medium text-slate-100">{personaName}</span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 text-sm mt-16">
              <p className="text-slate-300">Hi, I&apos;m {personaName}.</p>
              <p className="mt-1">{greeting}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-[#22d3ee] text-[#06222a]" : "bg-slate-800/70 text-slate-100"
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
          This chat is processed by AI. Conversations may be logged.
          {!badgeRemoved && " Built with Pocket Agent."}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">
        {label}
        {required && <span className="text-[#22d3ee]"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#22d3ee]"
      />
    </label>
  );
}

function PoweredBy() {
  return (
    <div className="shrink-0 py-2 text-center text-[10px] text-slate-600">Built with Pocket Agent.</div>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
