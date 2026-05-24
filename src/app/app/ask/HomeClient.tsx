"use client";

import { useState, useEffect, useRef } from "react";
import AlienCore from "../_components/AlienCore";

// ─── Types ─────────────────────────────────────────────────────────────────────

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

// ─── Utilities ─────────────────────────────────────────────────────────────────

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

// ─── Brain Organ Panel ─────────────────────────────────────────────────────────

function BrainOrganPanel({ brainRepo }: { brainRepo: string | null }) {
  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brainRepo) {
      setLoading(false);
      return;
    }
    fetch("/api/app/brain/completeness")
      .then((r) => (r.ok ? (r.json() as Promise<CompletenessData>) : Promise.reject()))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brainRepo]);

  if (!brainRepo) {
    return (
      <div
        className="rounded-xl flex flex-col gap-3 p-4 h-full"
        style={{ border: "1px solid rgba(51,65,85,0.5)", background: "rgba(7,13,18,0.5)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 tracking-[0.16em] uppercase">Agent Brain</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          No brain connected.{" "}
          <a
            href="/app/onboarding"
            className="text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors underline"
          >
            Connect one →
          </a>
        </p>
        <div className="flex flex-col gap-1.5 mt-auto">
          {["Identity", "Services", "Voice", "Clients", "Decisions", "Projects"].map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded"
              style={{ color: "rgba(100,116,139,0.7)", border: "1px dashed rgba(51,65,85,0.4)" }}
            >
              <span style={{ fontSize: 8 }}>○</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl flex flex-col gap-3 p-4 h-full"
      style={{
        border: "1px solid rgba(34,211,238,0.1)",
        background: "rgba(7,13,18,0.7)",
        animation: "brain-pulse 5s ease-in-out infinite",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Live dot */}
          <div className="relative flex items-center justify-center" style={{ width: 12, height: 12 }}>
            <div
              className="absolute inset-0 rounded-full border border-[#22d3ee]/25"
              style={{ animation: "halo-out 3.5s ease-out 0.5s infinite" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "rgba(34,211,238,0.8)", boxShadow: "0 0 3px rgba(34,211,238,0.4)" }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-400 tracking-[0.16em] uppercase">Agent Brain</span>
        </div>
        {data && (
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: data.pct >= 100 ? "#22d3ee" : "rgba(34,211,238,0.45)",
              background: data.pct >= 100 ? "rgba(34,211,238,0.1)" : "rgba(34,211,238,0.04)",
            }}
          >
            {data.pct >= 100 ? "full" : `${data.pct}%`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          <div className="h-0.5 bg-slate-800 rounded-full animate-pulse" />
          <div className="grid grid-cols-2 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-5 bg-slate-800/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Growth bar */}
          <div>
            <div className="h-px rounded-full overflow-hidden" style={{ background: "rgba(30,41,59,0.8)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${data.pct}%`,
                  background: "linear-gradient(to right, rgba(34,211,238,0.5), #22d3ee)",
                  transition: "width 1400ms ease-in-out",
                  boxShadow: data.pct > 0 ? "0 0 6px rgba(34,211,238,0.3)" : "none",
                }}
              />
            </div>
            <p className="text-[9px] font-mono text-slate-700 mt-1">
              {data.filled}/{data.total} memory cores
            </p>
          </div>

          {/* Memory chips */}
          <div className="grid grid-cols-2 gap-1 flex-1">
            {data.areas.map((area) => (
              <div
                key={area.key}
                className="flex items-center gap-1.5 text-[9px] px-1.5 py-1 rounded transition-all"
                style={{
                  color: area.filled ? "rgba(203,213,225,0.9)" : "rgba(100,116,139,0.7)",
                  background: area.filled ? "rgba(34,211,238,0.06)" : "transparent",
                  border: area.filled
                    ? "1px solid rgba(34,211,238,0.12)"
                    : "1px dashed rgba(51,65,85,0.5)",
                }}
                title={area.desc}
              >
                <span style={{ color: area.filled ? "#22d3ee" : "rgba(51,65,85,0.4)", fontSize: 7, flexShrink: 0 }}>
                  {area.filled ? "◈" : "○"}
                </span>
                <span className="truncate font-mono">{area.label}</span>
              </div>
            ))}
          </div>

          {data.pct < 100 && (
            <a
              href="/app/onboarding?update=1"
              className="text-[9px] font-mono transition-colors block"
              style={{ color: "rgba(34,211,238,0.5)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#22d3ee")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(34,211,238,0.5)")}
            >
              Feed it more context →
            </a>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-700">
          <span className="font-mono">{brainRepo}</span>
        </p>
      )}
    </div>
  );
}

// ─── Needs You Feed ────────────────────────────────────────────────────────────

function NeedsYouPanel() {
  return (
    <div
      className="rounded-xl flex flex-col gap-3 p-4 h-full"
      style={{ border: "1px solid rgba(51,65,85,0.45)", background: "rgba(7,13,18,0.5)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400 tracking-[0.16em] uppercase">Needs you</span>
        <span className="text-[9px] font-mono text-slate-500">0</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ border: "1px solid rgba(51,65,85,0.4)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(71,85,105,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-[10px] text-slate-700 leading-relaxed max-w-[140px]">
          Connect a tool and I&apos;ll start clearing things
        </p>
      </div>
    </div>
  );
}

// ─── Hub View ─────────────────────────────────────────────────────────────────

const CHIPS = [
  { label: "Research", scaffold: "Research [topic] and summarize what I know about it based on my memory files." },
  { label: "Summarize", scaffold: "Summarize [topic or project] based on what's in my memory files." },
  { label: "Draft", scaffold: "Draft [type of content] in my voice based on context from my memory files." },
  { label: "Analyze", scaffold: "Analyze [situation] using context from my memory files and give me a clear assessment." },
  { label: "Decide", scaffold: "Help me make a decision about [topic]. Here's what I'm weighing: [options]" },
];

function HubView({
  brainRepo,
  hasApiKey,
  hasGithubToken,
  inputValue,
  setInputValue,
  isLoading,
  handleSubmit,
  handleKeyDown,
  textareaRef,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  hasGithubToken: boolean;
  inputValue: string;
  setInputValue: (v: string) => void;
  isLoading: boolean;
  handleSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div
      className="h-full overflow-y-auto"
      style={{ animation: "hub-fadein 0.4s ease-out" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Alien core — the centerpiece */}
        <div className="flex flex-col items-center gap-2">
          <AlienCore brainRepo={brainRepo} />
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ background: "rgba(34,211,238,0.8)", boxShadow: "0 0 4px rgba(34,211,238,0.5)" }}
            />
            <span className="text-[11px] font-mono text-slate-400 tracking-[0.12em]">
              {brainRepo ? "online · reading your brain" : "online · waiting for context"}
            </span>
          </div>
        </div>

        {/* No-brain / no-GitHub nudge */}
        {!brainRepo && (
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
            style={{ border: "1px solid rgba(51,65,85,0.45)", background: "rgba(7,13,18,0.5)" }}
          >
            <p className="text-xs text-slate-400 leading-relaxed">
              {hasGithubToken
                ? "Brain not connected — your agent is flying blind."
                : "Connect GitHub so your agent can read and write your brain."}
            </p>
            {hasGithubToken ? (
              <a
                href="/app/onboarding"
                className="shrink-0 text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors whitespace-nowrap"
              >
                Connect brain →
              </a>
            ) : (
              <a
                href="/api/app/auth/github?next=/app/onboarding"
                className="shrink-0 text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors whitespace-nowrap"
              >
                Connect GitHub →
              </a>
            )}
          </div>
        )}

        {/* Status panels */}
        <div className="grid grid-cols-2 gap-3" style={{ minHeight: 200 }}>
          <NeedsYouPanel />
          <BrainOrganPanel brainRepo={brainRepo} />
        </div>

        {/* Input */}
        {!hasApiKey ? (
          <div
            className="rounded-xl px-5 py-4 space-y-3"
            style={{ border: "1px solid rgba(34,211,238,0.15)", background: "rgba(34,211,238,0.04)" }}
          >
            <p className="text-sm font-medium text-slate-200">Add your Anthropic API key to start.</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pocket Agent uses your own key — you control the bill, your data stays yours.{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22d3ee] hover:underline"
              >
                Get a key →
              </a>
            </p>
            <a
              href="/app/settings"
              className="inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
            >
              Go to Settings
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(51,65,85,0.6)", background: "rgba(7,13,18,0.7)" }}
            >
              <textarea
                ref={textareaRef}
                rows={3}
                placeholder="What did I decide about pricing? Draft a quote for Johnson. Summarize my current projects."
                className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none resize-none"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: "1px solid rgba(51,65,85,0.4)" }}
              >
                <div className="flex gap-1.5 flex-wrap">
                  {CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => setInputValue(chip.scaffold)}
                      className="rounded px-2.5 py-1 text-[10px] font-mono text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-all"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-slate-700 font-mono">⌘↵</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!inputValue.trim() || isLoading}
                    className="rounded-lg bg-[#22d3ee] px-4 py-1.5 text-xs font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "Working…" : "Ask"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Work surface */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.16em] uppercase">
              What I can do for you
            </span>
            <a
              href="/app/apps"
              className="text-[10px] font-mono text-slate-500 hover:text-[#22d3ee] transition-colors"
            >
              All →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                href: "/app/apps/quote",
                label: "Quote / Proposal",
                desc: "Reads your brain. Drafts a clean quote.",
              },
              {
                href: "/app/apps/email",
                label: "Email Drafter",
                desc: "Writes emails that sound like you.",
              },
            ].map((app) => (
              <a
                key={app.href}
                href={app.href}
                className="group rounded-xl px-4 py-3 transition-all"
                style={{
                  border: "1px solid rgba(51,65,85,0.45)",
                  background: "rgba(7,13,18,0.4)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,65,85,0.7)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(7,13,18,0.7)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,65,85,0.45)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(7,13,18,0.4)";
                }}
              >
                <p className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  {app.label}
                </p>
                <p className="text-[10px] text-slate-700 mt-0.5 leading-relaxed">{app.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Guide — level context, woven in quietly */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ border: "1px solid rgba(51,65,85,0.3)", background: "rgba(7,13,18,0.3)" }}
        >
          <div className="flex items-center gap-4 overflow-x-auto">
            {[
              { n: 1, label: "Knows you", active: Boolean(brainRepo) },
              { n: 2, label: "Drafts for you", active: false },
              { n: 3, label: "Acts for you", active: false },
            ].map((level, i) => (
              <div key={level.n} className="flex items-center gap-2 shrink-0">
                <span
                  className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold border shrink-0"
                  style={{
                    background: level.active ? "rgba(34,211,238,0.15)" : "rgba(30,41,59,0.5)",
                    borderColor: level.active ? "rgba(34,211,238,0.5)" : "rgba(51,65,85,0.5)",
                    color: level.active ? "#22d3ee" : "rgba(71,85,105,0.7)",
                  }}
                >
                  {level.active ? "✓" : level.n}
                </span>
                <span
                  className="text-[10px] font-mono whitespace-nowrap"
                  style={{ color: level.active ? "rgba(148,163,184,0.7)" : "rgba(51,65,85,0.6)" }}
                >
                  {level.label}
                </span>
                {i < 2 && (
                  <span className="text-slate-800 text-xs shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Conversation Sidebar ─────────────────────────────────────────────────────

function ConvSidebar({
  conversations,
  activeConvId,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside
      className="hidden lg:flex w-[152px] shrink-0 flex-col h-full"
      style={{ borderRight: "1px solid rgba(30,41,59,0.6)" }}
    >
      <div className="px-3 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(30,41,59,0.6)" }}>
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-800/40 transition-all font-mono"
          style={{ border: "1px solid rgba(51,65,85,0.4)" }}
        >
          <span className="text-[#22d3ee] font-bold text-sm leading-none">+</span>
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-3 text-[10px] font-mono text-slate-700">No threads yet.</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition-all mb-0.5 ${
                activeConvId === conv.id
                  ? "bg-slate-800/60 text-slate-200"
                  : "text-slate-600 hover:bg-slate-800/30 hover:text-slate-400"
              }`}
            >
              <div className="truncate text-[10px] font-medium leading-snug">{conv.title}</div>
              <div className="text-[9px] font-mono text-slate-700 mt-0.5">
                {relativeTime(conv.updated_at)}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HomeClient({
  brainRepo,
  hasApiKey,
  hasGithubToken,
  initialConversations,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  hasGithubToken: boolean;
  initialConversations: Conversation[];
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  function goToHub() {
    setActiveConvId(null);
    setInputValue("");
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
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
        const errData = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
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
          prev.map((c) => (c.id === convId ? { ...c, title: data.conversationTitle! } : c)),
        );
      }

      setConversations((prev) =>
        prev
          .map((c) => (c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c))
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
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

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-full overflow-hidden bg-[#05070a]">
      {/* Conversation sidebar */}
      <ConvSidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={(id) => setActiveConvId(id)}
        onNew={goToHub}
      />

      {/* Main pane */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {activeConvId ? (
          /* ── Active conversation ─────────────────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* Conversation header */}
            <div
              className="flex items-center gap-3 px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(30,41,59,0.8)" }}
            >
              <button
                onClick={goToHub}
                className="text-slate-600 hover:text-slate-300 text-sm transition-colors font-mono flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Hub
              </button>
              <span className="text-slate-800">·</span>
              <span className="text-sm text-slate-500 truncate">{activeConv?.title ?? "Conversation"}</span>
              <button
                onClick={goToHub}
                className="ml-auto text-xs font-mono text-slate-700 hover:text-[#22d3ee] transition-colors flex items-center gap-1"
              >
                + New
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 min-h-0">
              <div className="max-w-2xl mx-auto space-y-6">
                {messages.map((msg) => {
                  const citations =
                    msg.role === "assistant"
                      ? (msg.citations ?? parseCitations(msg.content))
                      : [];
                  return (
                    <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
                      {msg.role === "user" ? (
                        <div
                          className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap"
                          style={{
                            background: "rgba(13,37,53,0.9)",
                            border: "1px solid rgba(26,61,83,0.8)",
                          }}
                        >
                          {msg.content}
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-w-full">
                          <div className="text-[9px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase">
                            Pocket Agent
                          </div>
                          {msg.toolSteps && msg.toolSteps.length > 0 && (
                            <div className="flex flex-col gap-1 py-1">
                              {msg.toolSteps.map((step, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-1.5 text-[10px] font-mono text-slate-700"
                                >
                                  <span className="text-[#22d3ee]/25 shrink-0">{toolStepIcon(step.tool)}</span>
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
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono"
                                  style={{
                                    background: "rgba(30,41,59,0.6)",
                                    color: "rgba(34,211,238,0.55)",
                                  }}
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
                    <div className="text-[9px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase">
                      Pocket Agent
                    </div>
                    <div className="text-sm text-slate-600 animate-pulse">Working…</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div
              className="px-5 py-4 shrink-0"
              style={{ borderTop: "1px solid rgba(30,41,59,0.8)" }}
            >
              <div className="max-w-2xl mx-auto">
                {!hasApiKey ? (
                  <p className="text-sm text-slate-500 text-center">
                    <a href="/app/settings" className="text-[#22d3ee] hover:underline">
                      Add your Anthropic API key
                    </a>{" "}
                    to continue.
                  </p>
                ) : (
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={textareaRef}
                      rows={2}
                      placeholder="Continue… (⌘↵ to send)"
                      className="flex-1 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none resize-none"
                      style={{
                        border: "1px solid rgba(51,65,85,0.6)",
                        background: "rgba(7,13,18,0.7)",
                      }}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(51,65,85,0.6)")}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isLoading}
                      className="rounded-xl px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      style={{ background: "#22d3ee" }}
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Hub (no active conversation) ───────────────────────────────── */
          <HubView
            brainRepo={brainRepo}
            hasApiKey={hasApiKey}
            hasGithubToken={hasGithubToken}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            handleSubmit={handleSubmit}
            handleKeyDown={handleKeyDown}
            textareaRef={textareaRef}
          />
        )}
      </div>
    </div>
  );
}
