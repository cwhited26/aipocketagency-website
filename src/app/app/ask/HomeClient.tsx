"use client";

import { useState, useEffect, useRef } from "react";

// ─── Brain completeness panel ──────────────────────────────────────────────────

type CompletenessArea = {
  key: string;
  label: string;
  desc: string;
  filled: boolean;
};

type CompletenessData = {
  filled: number;
  total: number;
  pct: number;
  areas: CompletenessArea[];
};

function BrainPanel({ brainRepo }: { brainRepo: string }) {
  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/brain/completeness")
      .then((r) => (r.ok ? (r.json() as Promise<CompletenessData>) : Promise.reject()))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const hungry = data && data.pct < 100;

  return (
    <div
      className="mb-7 rounded-xl overflow-hidden"
      style={{
        border: "1px solid",
        borderColor: hungry ? "rgba(34,211,238,0.14)" : "rgba(51,65,85,0.8)",
        background: "rgba(7,13,18,0.7)",
        animation: "brain-pulse 5s ease-in-out infinite",
      }}
    >
      {/* Header — agent identity */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          {/* Pulsing entity dot */}
          <div className="relative flex items-center justify-center" style={{ width: 14, height: 14 }}>
            <div
              className="absolute inset-0 rounded-full border border-[#22d3ee]/30"
              style={{ animation: "halo-out 3.5s ease-out 0.5s infinite" }}
            />
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{
                background: "radial-gradient(circle, #22d3ee 0%, rgba(34,211,238,0.4) 100%)",
                boxShadow: "0 0 4px rgba(34,211,238,0.4)",
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-400 tracking-[0.18em] uppercase">
            Agent Brain
          </span>
          {data && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: data.pct >= 100 ? "#22d3ee" : "rgba(34,211,238,0.5)",
                background: data.pct >= 100 ? "rgba(34,211,238,0.12)" : "rgba(34,211,238,0.05)",
              }}
            >
              {data.pct >= 100 ? "FULLY LOADED" : `${data.pct}% LOADED`}
            </span>
          )}
        </div>
        <a
          href="/app/onboarding?update=1"
          className="text-[10px] font-mono transition-colors"
          style={{ color: "rgba(34,211,238,0.55)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(34,211,238,0.55)")}
        >
          Feed it →
        </a>
      </div>

      {loading ? (
        <div className="px-4 py-3.5 space-y-2.5">
          <div className="h-1 bg-slate-800 rounded-full animate-pulse" />
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-6 bg-slate-800/40 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : data ? (
        <div className="px-4 py-3 space-y-3">
          {/* Growth bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-slate-600">
                {data.filled}/{data.total} memory cores active
              </span>
            </div>
            <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(30,41,59,0.8)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${data.pct}%`,
                  background: "linear-gradient(to right, rgba(34,211,238,0.6), #22d3ee)",
                  transition: "width 1400ms ease-in-out",
                  boxShadow: data.pct > 0 ? "0 0 8px rgba(34,211,238,0.4)" : "none",
                }}
              />
            </div>
          </div>

          {/* Memory node chips */}
          <div className="grid grid-cols-3 gap-1.5">
            {data.areas.map((area) => (
              <div
                key={area.key}
                className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg transition-all"
                style={{
                  color: area.filled ? "rgba(148,163,184,0.9)" : "rgba(71,85,105,0.7)",
                  background: area.filled ? "rgba(34,211,238,0.06)" : "transparent",
                  border: area.filled ? "1px solid rgba(34,211,238,0.12)" : "1px dashed rgba(51,65,85,0.5)",
                }}
                title={area.desc}
              >
                <span
                  style={{
                    color: area.filled ? "#22d3ee" : "rgba(71,85,105,0.5)",
                    fontSize: 8,
                    flexShrink: 0,
                  }}
                >
                  {area.filled ? "◈" : "○"}
                </span>
                <span className="truncate font-mono" style={{ fontSize: 9 }}>{area.label}</span>
              </div>
            ))}
          </div>

          {/* Hunger signal */}
          {hungry && (
            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(71,85,105,0.8)" }}>
              {data.total - data.filled} core{data.total - data.filled !== 1 ? "s" : ""} dormant
              {" "}— your agent is hungry for more context.{" "}
              <a
                href="/app/onboarding?update=1"
                className="underline transition-colors"
                style={{ color: "rgba(34,211,238,0.5)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(34,211,238,0.5)")}
              >
                Feed it →
              </a>
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="text-xs" style={{ color: "rgba(71,85,105,0.8)" }}>
            Agent connected to{" "}
            <span className="font-mono" style={{ color: "rgba(100,116,139,0.9)" }}>{brainRepo}</span>
          </p>
        </div>
      )}
    </div>
  );
}

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Citation = { file: string; line: string };

type ToolStep = {
  tool: string;
  label: string;
};

type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  citations?: Citation[];
  toolSteps?: ToolStep[];
};

type ConversationDetail = {
  conversation: Conversation;
  messages: Message[];
};

const CHIPS = [
  { label: "Research", scaffold: "Research [topic] and summarize what I know about it based on my memory files." },
  { label: "Summarize", scaffold: "Summarize [topic or project] based on what's in my memory files." },
  { label: "Draft", scaffold: "Draft [type of content] in my voice based on context from my memory files." },
  { label: "Analyze", scaffold: "Analyze [situation] using context from my memory files and give me a clear assessment." },
  { label: "Decide", scaffold: "Help me make a decision about [topic]. Here's what I'm weighing: [options]" },
];

const SUGGESTIONS = [
  {
    title: "Summarize my last 3 decisions",
    prompt: "Summarize the last 3 decisions I made according to my decision log.",
  },
  {
    title: "What needs my attention today?",
    prompt:
      "Based on my current projects and active decisions, what should I focus on today?",
  },
  {
    title: "What did I decide about pricing?",
    prompt:
      "What did I decide about pricing? Walk me through the relevant decisions and context from my memory.",
  },
];

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function parseCitations(text: string): Citation[] {
  const re = /\[?(memory\/[^\]:\s]+\.md)(?::(\d+))?\]?/g;
  const seen = new Set<string>();
  const citations: Citation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}:${m[2] ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({ file: m[1], line: m[2] ?? "" });
    }
  }
  return citations;
}

function toolStepIcon(tool: string): string {
  switch (tool) {
    case "list_brain_files": return "◈";
    case "read_brain_file": return "◉";
    case "draft_quote": return "◆";
    case "draft_email": return "◇";
    default: return "○";
  }
}

function MaturityBar({ hasBrain }: { hasBrain: boolean }) {
  const activeLevel = hasBrain ? 1 : 0;

  const levels = [
    { n: 1, short: "Knows your business", why: "Feed it context so it stops making you re-explain yourself." },
    { n: 2, short: "Drafts in your voice", why: "Connect your voice spec and it writes the way you think." },
    { n: 3, short: "Acts in your tools", why: "Give it access and it does the work — not just the advice." },
  ];

  return (
    <div className="border-b border-slate-800/60 bg-slate-900/30 px-6 py-3">
      <div className="max-w-2xl mx-auto flex items-center gap-2 overflow-x-auto">
        {levels.map((l, i) => (
          <div key={l.n} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-2 ${
                l.n <= activeLevel ? "text-[#22d3ee]" : "text-slate-600"
              }`}
              title={l.why}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold border shrink-0 ${
                  l.n <= activeLevel
                    ? "bg-[#22d3ee]/20 border-[#22d3ee]/60 text-[#22d3ee]"
                    : "bg-slate-800 border-slate-700 text-slate-600"
                }`}
              >
                {l.n <= activeLevel ? "✓" : l.n}
              </span>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  l.n <= activeLevel
                    ? "text-[#22d3ee]"
                    : l.n === activeLevel + 1
                    ? "text-slate-500"
                    : "text-slate-700"
                }`}
              >
                {l.n <= activeLevel ? "" : ""}Level {l.n}: {l.short}
                {l.n > activeLevel && (
                  <span className="ml-1 text-slate-700 text-[10px]">— coming</span>
                )}
              </span>
            </div>
            {i < levels.length - 1 && (
              <span className="mx-3 text-slate-700 text-xs shrink-0">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeClient({
  brainRepo,
  hasApiKey,
  initialConversations,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  initialConversations: Conversation[];
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    fetch(`/api/app/conversations/${activeConvId}`)
      .then((r) => (r.ok ? (r.json() as Promise<ConversationDetail>) : Promise.reject()))
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {});
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleNewConversation() {
    setActiveConvId(null);
    setInputValue("");
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleSelectConversation(id: string) {
    setActiveConvId(id);
    setSidebarOpen(false);
  }

  function prefillInput(text: string) {
    setInputValue(text);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleSubmit() {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    setInputValue("");
    setIsLoading(true);

    const tempId = `tmp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempId,
      conversation_id: activeConvId ?? "",
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let convId = activeConvId;
      if (!convId) {
        const res = await fetch("/api/app/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("Failed to create conversation");
        const data = (await res.json()) as { conversation: Conversation };
        convId = data.conversation.id;
        setActiveConvId(convId);
        setConversations((prev) => [data.conversation, ...prev]);
      }

      const res = await fetch(`/api/app/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        const errText = errData.message ?? errData.error ?? "Something went wrong. Try again.";
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { ...tempUserMsg, id: `${tempId}-sent` },
          {
            id: `err-${Date.now()}`,
            conversation_id: convId!,
            role: "assistant" as const,
            content: errText,
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      const data = (await res.json()) as {
        userMessage: Message;
        assistantMessage: Message & { citations?: Citation[]; toolSteps?: ToolStep[] };
        conversationTitle?: string;
      };

      setMessages((prev) => [
        ...prev.slice(0, -1),
        data.userMessage,
        data.assistantMessage,
      ]);

      if (data.conversationTitle) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, title: data.conversationTitle! } : c,
          ),
        );
      }

      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          ),
      );
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { ...tempUserMsg, id: `${tempId}-sent` },
        {
          id: `err-${Date.now()}`,
          conversation_id: activeConvId ?? "",
          role: "assistant" as const,
          content: "Network error. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const hasBrain = Boolean(brainRepo);
  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden bg-[#05070a]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-60 shrink-0 flex flex-col bg-[#070d12] border-r border-slate-800 transform transition-transform duration-200 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <span className="text-[#22d3ee] font-bold text-base leading-none">+</span>
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {conversations.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-700">No conversations yet.</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5 ${
                  activeConvId === conv.id
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:bg-slate-800/40 hover:text-slate-300"
                }`}
              >
                <div className="truncate text-xs font-medium">{conv.title}</div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  {relativeTime(conv.updated_at)}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-2 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-100 text-lg leading-none"
          >
            ☰
          </button>
          <span className="text-sm text-slate-500 truncate">
            {activeConv ? activeConv.title : "Pocket Agent"}
          </span>
        </div>

        {activeConvId ? (
          /* ── Conversation view ── */
          <div className="flex flex-col h-full min-h-0">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3 shrink-0">
              <button
                onClick={handleNewConversation}
                className="text-slate-600 hover:text-slate-300 text-sm transition-colors"
              >
                ← Home
              </button>
              <span className="text-slate-800">|</span>
              <span className="text-sm text-slate-500 truncate">{activeConv?.title}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
              <div className="max-w-2xl mx-auto space-y-6">
                {messages.map((msg) => {
                  const citations =
                    msg.role === "assistant"
                      ? (msg.citations ?? parseCitations(msg.content))
                      : [];
                  return (
                    <div
                      key={msg.id}
                      className={msg.role === "user" ? "flex justify-end" : ""}
                    >
                      {msg.role === "user" ? (
                        <div className="max-w-[82%] bg-[#0d2535] border border-[#1a3d53] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-w-full">
                          <div className="text-[10px] text-[#22d3ee]/70 font-mono tracking-widest uppercase">
                            Pocket Agent
                          </div>
                          {/* Tool steps transcript */}
                          {msg.toolSteps && msg.toolSteps.length > 0 && (
                            <div className="flex flex-col gap-1 py-1">
                              {msg.toolSteps.map((step, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600"
                                >
                                  <span className="text-[#22d3ee]/30 shrink-0">
                                    {toolStepIcon(step.tool)}
                                  </span>
                                  {step.label}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </div>
                          {citations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {citations.map((c, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-mono text-[#22d3ee]/60"
                                >
                                  {c.file}
                                  {c.line ? `:${c.line}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-[#22d3ee]/70 font-mono tracking-widest uppercase">
                      Pocket Agent
                    </div>
                    <div className="text-sm text-slate-600 animate-pulse">Working…</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Conversation input bar */}
            <div className="border-t border-slate-800 px-4 py-4 shrink-0">
              <div className="max-w-2xl mx-auto">
                {!hasApiKey ? (
                  <p className="text-sm text-slate-500 text-center">
                    <a href="/app/settings" className="text-[#22d3ee] hover:underline">
                      Add your Anthropic API key
                    </a>{" "}
                    to continue this conversation.
                  </p>
                ) : (
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={textareaRef}
                      rows={2}
                      placeholder="Continue the conversation… (⌘↵ to send)"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isLoading}
                      className="rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Home view ── */
          <div className="flex-1 overflow-y-auto">
            <MaturityBar hasBrain={hasBrain} />

            <div className="max-w-2xl mx-auto px-6 pt-8 pb-4">
              {/* Brain panel (when connected) or no-brain banner */}
              {hasBrain ? (
                <BrainPanel brainRepo={brainRepo!} />
              ) : (
                <div className="mb-7 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex items-start gap-3">
                  <span className="text-amber-400 shrink-0 mt-0.5">⚡</span>
                  <div>
                    <p className="text-sm font-medium text-amber-300">No brain connected yet</p>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                      Connect a GitHub repo with your memory files and Pocket Agent will give
                      answers sourced from your actual business context — no re-explaining
                      yourself.{" "}
                      <a href="/app/onboarding" className="text-[#22d3ee] hover:underline">
                        Connect a brain →
                      </a>
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-100">
                  What can I help you build today?
                </h1>
                <p className="text-slate-500 text-sm mt-1.5">
                  {hasBrain
                    ? `Sourcing context from ${brainRepo}`
                    : "A partner that thinks in your context. Connect a brain to unlock it."}
                </p>
              </div>

              {!hasApiKey ? (
                <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-5 space-y-3">
                  <p className="text-sm font-medium text-slate-200">
                    Add your Anthropic API key to start.
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Pocket Agent uses your own Anthropic key — you control the bill and your data
                    stays yours. Get a free key at{" "}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#22d3ee] hover:underline"
                    >
                      console.anthropic.com
                    </a>
                    .
                  </p>
                  <a
                    href="/app/settings"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
                  >
                    Go to Settings →
                  </a>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <textarea
                      ref={textareaRef}
                      rows={4}
                      placeholder="What did I decide about pricing? Write a quote for the Johnson reroof and email it to him. Summarize my current projects."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-700">⌘↵ to submit</span>
                      <button
                        onClick={handleSubmit}
                        disabled={!inputValue.trim() || isLoading}
                        className="rounded-lg bg-[#22d3ee] px-5 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? "Working…" : "Ask"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={() => prefillInput(chip.scaffold)}
                        className="rounded-full border border-slate-800 bg-slate-900 px-4 py-1.5 text-xs text-slate-500 hover:border-[#22d3ee]/40 hover:text-[#22d3ee] transition-colors"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="max-w-2xl mx-auto px-6 pb-6">
              <p className="text-[10px] text-slate-700 font-mono tracking-[0.15em] uppercase mb-3">
                Suggested for you
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => prefillInput(s.prompt)}
                    className="text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 hover:border-slate-700 hover:bg-slate-900/80 transition-colors group"
                  >
                    <p className="text-xs text-slate-400 group-hover:text-slate-200 font-medium leading-relaxed">
                      {s.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 pb-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-700 font-mono tracking-[0.15em] uppercase">
                  Work apps · Level 2
                </p>
                <a
                  href="/app/apps"
                  className="text-[10px] text-slate-600 hover:text-[#22d3ee] font-mono transition-colors"
                >
                  All apps →
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="/app/apps/quote"
                  className="text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 hover:border-slate-700 hover:bg-slate-900/80 transition-colors group block"
                >
                  <p className="text-xs text-slate-400 group-hover:text-slate-200 font-medium leading-relaxed">
                    Quote / Proposal Writer
                  </p>
                  <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                    Reads your brain. Drafts a clean quote.
                  </p>
                </a>
                <a
                  href="/app/apps/email"
                  className="text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 hover:border-slate-700 hover:bg-slate-900/80 transition-colors group block"
                >
                  <p className="text-xs text-slate-400 group-hover:text-slate-200 font-medium leading-relaxed">
                    Email Drafter
                  </p>
                  <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                    Writes emails that sound like you.
                  </p>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
