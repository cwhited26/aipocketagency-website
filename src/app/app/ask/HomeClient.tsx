"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Mascot, { type MascotState } from "@/components/Mascot";
import type { ActivityItem } from "@/app/api/app/brain/activity/route";
import { TryThesePanel, WorksWithPanel, ExamplePanel } from "../_components/TabGuide";
import { AgentSetupBar } from "../_components/AgentSetupBar";
import type { ConversationThread } from "@/lib/pa-conversations";
import type { ScaffoldEntry } from "@/lib/pa-brain";

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

// "kitchen-remodel-crm" → "Kitchen remodel crm" for a readable in-flight plan label.
function deslugify(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brainRepo]);

  if (!brainRepo) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 flex flex-col gap-3 p-4 h-full">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Agent Brain
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          No brain connected.{" "}
          <a href="/app/onboarding" className="text-[#22d3ee] hover:underline">
            Connect one →
          </a>
        </p>
        <div className="flex flex-col gap-1.5 mt-auto">
          {["Identity", "Services", "Voice", "Clients", "Decisions", "Projects"].map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded border border-dashed border-slate-700/60 text-slate-500"
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
      className="rounded-xl border border-slate-700/60 bg-slate-900/70 flex flex-col gap-3 p-4 h-full"
      style={{ animation: "brain-pulse 5s ease-in-out infinite" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center" style={{ width: 12, height: 12 }}>
            <div
              className="absolute inset-0 rounded-full border border-[#22d3ee]/25"
              style={{ animation: "halo-out 3.5s ease-out 0.5s infinite" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "rgba(34,211,238,0.85)", boxShadow: "0 0 4px rgba(34,211,238,0.5)" }}
            />
          </div>
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Agent Brain
          </span>
        </div>
        {data && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: data.pct >= 100 ? "#22d3ee" : "rgba(34,211,238,0.6)",
              background: data.pct >= 100 ? "rgba(34,211,238,0.12)" : "rgba(34,211,238,0.06)",
              border: "1px solid " + (data.pct >= 100 ? "rgba(34,211,238,0.3)" : "rgba(34,211,238,0.15)"),
            }}>
            {data.pct >= 100 ? "full" : `${data.pct}%`}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 flex-1">
          <div className="h-0.5 bg-slate-700 rounded-full animate-pulse" />
          <div className="grid grid-cols-2 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-5 bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          <div>
            <div className="h-px rounded-full overflow-hidden bg-slate-800">
              <div
                className="h-full rounded-full transition-[width] duration-[1400ms] ease-in-out"
                style={{
                  width: `${data.pct}%`,
                  background: "linear-gradient(to right, rgba(34,211,238,0.6), #22d3ee)",
                  boxShadow: data.pct > 0 ? "0 0 6px rgba(34,211,238,0.4)" : "none",
                }}
              />
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">
              {data.filled}/{data.total} memory cores
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 flex-1">
            {data.areas.map((area) => (
              <div
                key={area.key}
                className="flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded"
                style={{
                  color: area.filled ? "#CBD5E1" : "#64748B",
                  background: area.filled ? "rgba(34,211,238,0.07)" : "rgba(30,41,59,0.3)",
                  border: area.filled
                    ? "1px solid rgba(34,211,238,0.18)"
                    : "1px dashed rgba(51,65,85,0.6)",
                }}
                title={area.desc}
              >
                <span style={{ color: area.filled ? "#22d3ee" : "#475569", fontSize: 7, flexShrink: 0 }}>
                  {area.filled ? "◈" : "○"}
                </span>
                <span className="truncate font-mono">{area.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mt-auto">
            {data.pct < 100 && (
              <a href="/app/brain" className="text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors">
                Feed it →
              </a>
            )}
            <a href="/app/brain/digest" className="ml-auto text-[10px] font-mono text-slate-600 hover:text-[#22d3ee]/60 transition-colors whitespace-nowrap">
              weekly read →
            </a>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          <span className="font-mono text-slate-300">{brainRepo}</span>
        </p>
      )}
    </div>
  );
}

// ─── Activity Feed Panel ────────────────────────────────────────────────────────

function relativeActivity(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function kindDot(kind: ActivityItem["kind"]): string {
  switch (kind) {
    case "memory": return "◈";
    case "upload": return "▲";
    case "setup": return "◉";
    case "draft": return "◆";
    default: return "○";
  }
}

function ActivityFeedPanel({ brainRepo }: { brainRepo: string | null }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brainRepo) { setLoading(false); return; }
    fetch("/api/app/brain/activity")
      .then((r) => (r.ok ? (r.json() as Promise<{ items: ActivityItem[] }>) : Promise.reject()))
      .then((d) => { setItems(d.items.slice(0, 6)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brainRepo]);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 flex flex-col gap-3 p-4 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
          Recent activity
        </span>
        {!brainRepo && (
          <span className="text-[10px] font-mono text-slate-600">—</span>
        )}
      </div>

      {!brainRepo ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2.5 py-2">
          <div className="w-7 h-7 rounded-full border border-slate-700/60 flex items-center justify-center">
            <span className="text-[8px] text-slate-600">◯</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug max-w-[130px]">
            Connect your brain to see activity
          </p>
        </div>
      ) : loading ? (
        <div className="flex-1 flex flex-col gap-2 py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-slate-800/60 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-2">
          <p className="text-[11px] text-slate-500 leading-snug max-w-[140px]">
            No activity yet — finish setting up your brain to get started.
          </p>
          <a href="/app/onboarding" className="text-[10px] font-mono text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors">
            Set up brain →
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-1.5 min-w-0">
              <span
                className="shrink-0 text-[7px] mt-1 leading-none"
                style={{
                  color:
                    item.kind === "memory" ? "#22d3ee" :
                    item.kind === "upload" ? "rgba(34,211,238,0.7)" :
                    item.kind === "setup" ? "rgba(34,211,238,0.5)" :
                    "#475569",
                }}
              >
                {kindDot(item.kind)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-300 leading-snug truncate">{item.label}</p>
                <p className="text-[9px] font-mono text-slate-600 mt-0.5">
                  {relativeActivity(item.time)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <a
          href="/app/documents"
          className="text-[10px] font-mono text-[#22d3ee]/50 hover:text-[#22d3ee] transition-colors mt-auto block"
        >
          All documents →
        </a>
      )}
    </div>
  );
}

// ─── Mascot Nav Hub ────────────────────────────────────────────────────────────
// The creature is the centrepiece. Nav tentacles radiate from the body to 5
// clickable destination nodes. SVG nav layer sits behind the creature so the
// body correctly occludes the tendril origins; pointer-events-none on the
// creature div lets clicks fall through to the nav SVG.

type NavNodeDef = {
  id: string;
  label: string;
  href: string;
  connected: boolean;
  svgX: number;
  svgY: number;
  tendrilD: string;
  textAnchor: "start" | "middle" | "end";
  labelDx: number;
  labelDy: number;
  animDelay: string;
  animDur: string;
};

function MascotNavHub({
  brainRepo,
  mascotState,
  size = 260,
}: {
  brainRepo: string | null;
  mascotState: MascotState;
  size?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const router = useRouter();
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const flow = mounted && !reducedMotion;

  const height = Math.round((size * 400) / 380);
  const brainLabel = brainRepo
    ? (brainRepo.split("/")[1] ?? "Brain").slice(0, 14)
    : "Brain";
  const brainHref = brainRepo ? "/app/brain" : "/app/onboarding";

  // Node positions match AlienCore's clock layout, adapted to creature
  // centre (190, 184) in its native 380×400 viewBox.
  const nodes: NavNodeDef[] = [
    {
      id: "brain",
      label: brainLabel,
      href: brainHref,
      connected: Boolean(brainRepo),
      svgX: 190, svgY: 44,
      tendrilD: "M 190 184 C 190 138 190 88 190 44",
      textAnchor: "middle", labelDx: 0, labelDy: -12,
      animDelay: "0s", animDur: "6s",
    },
    {
      id: "quotes",
      label: "Quotes",
      href: "/app/apps/quote",
      connected: true,
      svgX: 307, svgY: 112,
      tendrilD: "M 190 184 C 234 168 278 140 307 112",
      textAnchor: "start", labelDx: 10, labelDy: 0,
      animDelay: "1.2s", animDur: "7s",
    },
    {
      id: "followups",
      label: "Follow-ups",
      href: "/app/apps/followups",
      connected: false,
      svgX: 284, svgY: 265,
      tendrilD: "M 190 184 C 222 208 258 246 284 265",
      textAnchor: "start", labelDx: 10, labelDy: 4,
      animDelay: "2.4s", animDur: "8s",
    },
    {
      id: "inbox",
      label: "Inbox",
      href: "/app/apps/inbox",
      connected: false,
      svgX: 96, svgY: 265,
      tendrilD: "M 190 184 C 158 208 122 246 96 265",
      textAnchor: "end", labelDx: -10, labelDy: 4,
      animDelay: "1.8s", animDur: "7.5s",
    },
    {
      id: "calendar",
      label: "Cal",
      href: "/app/apps/calendar",
      connected: false,
      svgX: 73, svgY: 112,
      tendrilD: "M 190 184 C 146 168 102 140 73 112",
      textAnchor: "end", labelDx: -10, labelDy: 0,
      animDelay: "0.6s", animDur: "6.5s",
    },
  ];

  return (
    <div className="relative" style={{ width: size, height }}>
      {/* Nav layer — rendered behind creature body */}
      {mounted && (
        <svg
          viewBox="0 0 380 400"
          width={size}
          height={height}
          className="absolute inset-0"
          aria-hidden="true"
          overflow="visible"
        >
          {nodes.map((node) => (
            <g key={node.id}>
              {/* Tendril body stroke — thick dark tube matching creature anatomy */}
              <path
                d={node.tendrilD}
                stroke="#1e3a52"
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Tendril cyan vein */}
              <path
                d={node.tendrilD}
                stroke="#22d3ee"
                strokeWidth={1.4}
                fill="none"
                strokeLinecap="round"
                opacity={node.connected ? 0.55 : 0.22}
                style={
                  node.connected
                    ? {
                        animation: `tendril-pulse ${node.animDur} ease-in-out ${node.animDelay} infinite`,
                      }
                    : {}
                }
              />

              {/* Data-flow pulse — a faint dot travels mascot → label, then fades.
                  Staggered per tendril via animDelay so they never pulse in unison. */}
              {flow && (
                <circle
                  r={2.2}
                  fill="#5eead4"
                  style={{
                    offsetPath: `path('${node.tendrilD}')`,
                    offsetRotate: "0deg",
                    animation: `mascot-tendril-flow ${node.animDur} linear ${node.animDelay} infinite`,
                    ["--flow-op" as string]: node.connected ? 0.85 : 0.4,
                    opacity: 0,
                  }}
                />
              )}

              {/* Clickable node group */}
              <g
                onClick={() => router.push(node.href)}
                style={{ cursor: "pointer" }}
                role="link"
                aria-label={`Go to ${node.label}`}
              >
                {/* 44 px invisible hit target (r=22 → diameter 44) */}
                <circle
                  cx={node.svgX}
                  cy={node.svgY}
                  r="22"
                  fill="rgba(0,0,0,0.001)"
                  pointerEvents="all"
                />

                {/* Tip glow halo */}
                <circle
                  cx={node.svgX}
                  cy={node.svgY}
                  r={9}
                  fill="#22d3ee"
                  opacity={node.connected ? 0.18 : 0.07}
                />

                {/* Tip dot */}
                <circle
                  cx={node.svgX}
                  cy={node.svgY}
                  r={node.connected ? 3.5 : 3}
                  fill="#5eead4"
                  opacity={node.connected ? 0.9 : 0.4}
                  style={
                    node.connected
                      ? {
                          animation: `node-beacon ${node.animDur} ease-in-out ${node.animDelay} infinite`,
                        }
                      : {}
                  }
                />

                {/* Label */}
                <text
                  x={node.svgX + node.labelDx}
                  y={node.svgY + node.labelDy}
                  textAnchor={node.textAnchor}
                  dominantBaseline="middle"
                  fill={
                    node.connected
                      ? "rgba(203,213,225,0.85)"
                      : "rgba(100,116,139,0.65)"
                  }
                  fontSize="11"
                  fontFamily="ui-monospace, 'Cascadia Code', monospace"
                  letterSpacing="0.04em"
                >
                  {node.label}
                </text>
              </g>
            </g>
          ))}
        </svg>
      )}

      {/* Creature — above nav layer, pointer-events-none so nav catches clicks.
          Reacts in real time: listening while composing, thinking in flight. */}
      <div className="absolute inset-0 pointer-events-none">
        <Mascot state={mascotState} size={size} noTendrils />
      </div>
    </div>
  );
}

// ─── Hub View ──────────────────────────────────────────────────────────────────

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
  hasConnection,
  setupBarDismissedAt,
  threads,
  scaffolds,
  inputValue,
  setInputValue,
  isLoading,
  mascotState,
  handleSubmit,
  handleKeyDown,
  textareaRef,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  hasGithubToken: boolean;
  hasConnection: boolean;
  setupBarDismissedAt: string | null;
  threads: ConversationThread[];
  scaffolds: ScaffoldEntry[];
  inputValue: string;
  setInputValue: (v: string) => void;
  isLoading: boolean;
  mascotState: MascotState;
  handleSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div className="h-full overflow-y-auto" style={{ animation: "hub-fadein 0.4s ease-out" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Mascot + tentacle nav — centrepiece */}
        <div className="flex flex-col items-center gap-3">
          <MascotNavHub brainRepo={brainRepo} mascotState={mascotState} size={260} />
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ background: "rgba(34,211,238,0.9)", boxShadow: "0 0 5px rgba(34,211,238,0.6)" }}
            />
            <span className="text-[12px] font-mono text-slate-300 tracking-[0.1em]">
              {brainRepo ? "online · reading your brain" : "online · waiting for context"}
            </span>
          </div>
        </div>

        {/* Status-bar onboarding — disappears once everything's wired */}
        <AgentSetupBar
          hasGithubToken={hasGithubToken}
          hasBrain={Boolean(brainRepo)}
          hasApiKey={hasApiKey}
          hasConnection={hasConnection}
          setupBarDismissedAt={setupBarDismissedAt}
        />

        {/* The full story — this is the one box that does everything */}
        <p className="text-sm text-slate-300 leading-relaxed text-center max-w-xl mx-auto">
          This is the one place you tell your agent what you want done — in plain English, like
          you&apos;d text a sharp assistant. Ask it to draft a recap from this morning&apos;s job
          walk-through, write follow-ups to everyone who stopped by your booth, or pull where a
          deal stands. It reads your brain for context, does the work, and stages anything that
          leaves your hands — an email, a meeting, an invoice — in your Inbox for you to approve.
          Big asks with several steps become a plan you sign off on first.
        </p>

        {/* Input — the primary interaction, first thing under the mascot */}
        {!hasApiKey ? (
          <div className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-5 py-5 space-y-3">
            <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key to start.</p>
            <p className="text-sm text-slate-300 leading-relaxed">
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors min-h-[44px]"
            >
              Go to Settings →
            </a>
          </div>
        ) : (
          <div>
            <div className="input-idle rounded-xl border bg-slate-900/80 overflow-hidden transition-[box-shadow]">
              <textarea
                ref={textareaRef}
                rows={5}
                placeholder="What do you want done?"
                className="w-full bg-transparent px-5 py-4 text-base text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/60 gap-2">
                <div className="flex gap-1 flex-wrap min-w-0">
                  {CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => setInputValue(chip.scaffold)}
                      className="rounded px-2.5 py-2 text-[11px] font-mono text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-all min-h-[36px]"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:block">⌘↵</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!inputValue.trim() || isLoading}
                    className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    {isLoading ? "Working…" : "Ask"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Setup CTA — shown when no brain connected */}
        {!brainRepo && (
          <div className={`rounded-xl border px-5 py-4 ${
            !hasGithubToken
              ? "border-[#22d3ee]/30 bg-[#22d3ee]/5"
              : "border-slate-700/60 bg-slate-900/60"
          }`}>
            {!hasGithubToken ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Step 1: Connect GitHub</p>
                  <p className="text-sm text-slate-300 mt-0.5">
                    Your agent needs GitHub access to read and write your brain.
                  </p>
                </div>
                <a
                  href="/api/app/auth/github?next=/app/onboarding"
                  className="self-start sm:self-auto shrink-0 inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors min-h-[44px]"
                >
                  Connect GitHub →
                </a>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Step 2: Connect your brain</p>
                  <p className="text-sm text-slate-300 mt-0.5">
                    GitHub connected. Create or link your brain repo so the agent knows your business.
                  </p>
                </div>
                <a
                  href="/app/onboarding"
                  className="self-start sm:self-auto shrink-0 inline-flex items-center rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-colors min-h-[44px]"
                >
                  Set up brain →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Try one of these — tap to drop it in the box above */}
        <TryThesePanel
          heading="Not sure what to ask? Tap one to drop it in the box"
          onPick={setInputValue}
          prompts={[
            "Draft a recap email from this morning's kitchen-remodel walk-through",
            "Pull everything we know about the Maple Street rebuild and tell me where it stands",
            "Write a follow-up to the three couples who stopped by our booth at the expo",
            "Turn my notes from yesterday's discovery call into a one-page summary",
          ]}
        />

        {/* Works with — where the work goes once the agent runs */}
        <WorksWithPanel
          items={[
            {
              href: "/app/apps/inbox",
              label: "Inbox",
              blurb: "Anything your agent wants to send or book waits here for your approval.",
            },
            {
              href: "/app/projects",
              label: "Projects",
              blurb: "Ask for something big — a whole system — and it becomes a plan you approve first.",
            },
            {
              href: "/app/personas",
              label: "Personas",
              blurb: "Route a chat to a sales or support version of your agent with its own voice.",
            },
            {
              href: "/app/brain",
              label: "Brain",
              blurb: "Every reply is grounded in what your agent knows about your business.",
            },
          ]}
        />

        {/* Recent threads — every conversation, plus any in-flight plans, right on the landing */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Recent threads
          </span>

          {scaffolds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {scaffolds.map((s) => (
                <a
                  key={s.slug}
                  href="/app/projects"
                  className="group flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[56px]"
                >
                  <span className="text-[#22d3ee]/60 shrink-0 text-sm">◆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                      {deslugify(s.slug)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">In-flight plan · {s.path}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600 group-hover:text-[#22d3ee]/70 transition-colors shrink-0">
                    View →
                  </span>
                </a>
              ))}
            </div>
          )}

          {threads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 px-5 py-6 text-center">
              <p className="text-sm text-slate-300">No threads yet.</p>
              <p className="text-[13px] text-slate-500 mt-1">
                Ask your agent something above and the conversation shows up here so you can pick it
                back up anytime.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {threads.slice(0, 6).map((t) => (
                <a
                  key={t.id}
                  href={`/app/ask?c=${t.id}`}
                  className="group block rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3.5 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[60px]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                      {t.title || "Untitled thread"}
                    </p>
                    <span className="shrink-0 text-[11px] font-mono text-slate-600">
                      {relativeTime(t.updated_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-400 mt-1 leading-relaxed line-clamp-1">
                    {t.snippet ?? "No messages yet."}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity — what your agent has been doing + how full your brain is */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Recent activity
          </span>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            Cards land here as your agent does work — drafts written, plans staged, briefs delivered.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActivityFeedPanel brainRepo={brainRepo} />
            <BrainOrganPanel brainRepo={brainRepo} />
          </div>
        </div>

        {/* See an example — a real thread shape, collapsed by default */}
        <ExamplePanel
          label="See an example thread"
          note="This is a sample. Type anything above and your real conversation starts here."
        >
          <div className="flex flex-col gap-3">
            <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-800 border border-slate-700/60 px-4 py-2.5 text-sm text-slate-100">
              Draft a recap email from this morning&apos;s kitchen-remodel walk-through.
            </div>
            <div className="self-start max-w-full">
              <div className="text-[10px] text-[#22d3ee]/70 font-mono tracking-[0.18em] uppercase mb-1.5">
                Pocket Agent
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-slate-800/60 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 leading-relaxed">
                <p>Pulled your walk-through notes from your brain. Here&apos;s the recap, in your voice:</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800/40 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400 font-mono">
{`Hi Dana —

Good walking the kitchen this morning. Quick recap of what
we settled on: cabinet layout, the quartz counters you liked,
and a four-week timeline once the permit clears.

Full line-item quote is coming your way — I'll hold it in
your Inbox so you can look it over before it sends.`}
                </pre>
                <p className="mt-2 text-[13px] text-slate-400">
                  Staged the recap email in your{" "}
                  <span className="text-[#22d3ee]/80">Inbox</span> — approve it whenever you&apos;re ready.
                </p>
              </div>
            </div>
          </div>
        </ExamplePanel>

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
    <aside className="hidden lg:flex w-[152px] shrink-0 flex-col h-full border-r border-slate-800/60">
      <div className="px-3 py-3 shrink-0 border-b border-slate-800/60">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 border border-slate-700/60 transition-all font-mono"
        >
          <span className="text-[#22d3ee] font-bold text-base leading-none">+</span>
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-3 text-[11px] font-mono text-slate-500">No threads yet.</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition-all mb-0.5 ${
                activeConvId === conv.id
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <div className="truncate text-[11px] font-medium leading-snug">{conv.title}</div>
              <div className="text-[10px] font-mono text-slate-600 mt-0.5">
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
  hasConnection,
  setupBarDismissedAt,
  initialConversations,
  threads,
  scaffolds,
  initialConversationId,
  initialQuery,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  hasGithubToken: boolean;
  // Whether any outside tool is connected — drives the setup status bar.
  hasConnection: boolean;
  // When the owner last hid the setup status bar (null = still showing).
  setupBarDismissedAt: string | null;
  initialConversations: Conversation[];
  // Recent conversations (with one-line previews) and in-flight plans, shown on the landing.
  threads: ConversationThread[];
  scaffolds: ScaffoldEntry[];
  // When the owner deep-links a thread (/app/ask?c=<id>), this restores it on load.
  initialConversationId: string | null;
  // When the owner taps a starter prompt on the Projects page (/app/ask?q=<text>), this seeds
  // the composer so they land with the ask already typed and can edit before sending.
  initialQuery: string | null;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(initialQuery ?? "");
  const [isLoading, setIsLoading] = useState(false);
  // Post-reply flourish — drives the mascot through tool_calling → responding → done
  // once a reply lands, then clears back to null. null means "let isLoading/typing decide."
  const [replyPhase, setReplyPhase] = useState<MascotState | null>(null);
  const flourishTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Single source of truth for the creature's mood, shared by the Hub mascot and
  // the in-thread reply indicator: explicit flourish wins, else in-flight = thinking,
  // else a composed-but-unsent ask = listening, else idle.
  const mascotState: MascotState =
    replyPhase ?? (isLoading ? "thinking" : inputValue.trim() ? "listening" : "idle");

  function clearFlourish() {
    flourishTimers.current.forEach(clearTimeout);
    flourishTimers.current = [];
  }
  // Play the celebratory beat after a reply arrives. If the agent ran a connector,
  // open with a tool_calling flare; otherwise go straight to the speaking pulse.
  function runFlourish(usedTools: boolean) {
    clearFlourish();
    const seq: [MascotState, number][] = usedTools
      ? [["tool_calling", 650], ["responding", 900], ["done", 650]]
      : [["responding", 750], ["done", 600]];
    let acc = 0;
    for (const [phase, dur] of seq) {
      flourishTimers.current.push(setTimeout(() => setReplyPhase(phase), acc));
      acc += dur;
    }
    flourishTimers.current.push(setTimeout(() => setReplyPhase(null), acc));
  }
  useEffect(() => () => clearFlourish(), []);

  // Load (restore) the active thread's full history. A failed load surfaces a visible notice
  // instead of a silent catch, so a stale ?c= link never strands the owner on a blank thread.
  useEffect(() => {
    if (!activeConvId) { setMessages([]); setThreadError(null); return; }
    setThreadError(null);
    fetch(`/api/app/conversations/${activeConvId}`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<ConversationDetail>)
          : Promise.reject(new Error(`Failed to load thread (${r.status})`)),
      )
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {
        setMessages([]);
        setThreadError("Couldn't load this thread. It may have been removed.");
      });
  }, [activeConvId]);

  // Keep the URL in sync with the open thread (without a server round-trip) so a refresh or the
  // browser back button restores the same conversation, and the Hub round-trip stays truthful.
  useEffect(() => {
    const url = activeConvId ? `/app/ask?c=${activeConvId}` : "/app/ask";
    window.history.replaceState(null, "", url);
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Start a fresh thread in place (used by the desktop rail + the in-thread "+ New" action).
  function startNewThread() {
    setActiveConvId(null);
    setInputValue("");
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  // "Back" from a thread lands on the Agent landing — the mascot page (this same surface with no
  // active thread), where the recent-threads list and Ask box live.
  function goToLanding() {
    setActiveConvId(null);
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
    clearFlourish();
    setReplyPhase(null);
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
          { id: `err-${Date.now()}`, conversation_id: convId!, role: "assistant" as const, content: errText, created_at: new Date().toISOString() },
        ]);
        return;
      }

      const data = (await res.json()) as {
        userMessage: Message;
        assistantMessage: Message & { citations?: Citation[]; toolSteps?: ToolStep[] };
        conversationTitle?: string;
      };

      setMessages((prev) => [...prev.slice(0, -1), data.userMessage, data.assistantMessage]);

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

      // Let the creature acknowledge what just happened — a tool flare if a
      // connector ran, then a speaking pulse, then a brief celebratory beat.
      runFlourish((data.assistantMessage.toolSteps?.length ?? 0) > 0);
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { ...tempUserMsg, id: `${tempId}-sent` },
        { id: `err-${Date.now()}`, conversation_id: activeConvId ?? "", role: "assistant" as const, content: "Network error. Please try again.", created_at: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-full overflow-hidden bg-[#06080b]">
      <ConvSidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={(id) => setActiveConvId(id)}
        onNew={startNewThread}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {activeConvId ? (
          /* ── Active conversation ─────────────────────────────────────── */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-5 py-3 shrink-0 border-b border-slate-800/60">
              <button
                onClick={goToLanding}
                className="text-slate-400 hover:text-slate-100 text-sm transition-colors font-mono flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Agent
              </button>
              <span className="text-slate-700">·</span>
              <span className="text-sm text-slate-300 truncate">{activeConv?.title ?? "Conversation"}</span>
              <button
                onClick={startNewThread}
                className="ml-auto text-[11px] font-mono text-slate-500 hover:text-[#22d3ee] transition-colors"
              >
                + New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 min-h-0">
              <div className="max-w-2xl mx-auto space-y-6">
                {threadError && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
                    {threadError}{" "}
                    <button onClick={goToLanding} className="underline hover:text-amber-100">
                      Back to Agent
                    </button>
                  </div>
                )}
                {messages.map((msg) => {
                  const citations =
                    msg.role === "assistant"
                      ? (msg.citations ?? parseCitations(msg.content))
                      : [];
                  return (
                    <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
                      {msg.role === "user" ? (
                        <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap bg-slate-800 border border-slate-700/60">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-w-full">
                          <div className="text-[10px] text-[#22d3ee]/70 font-mono tracking-[0.18em] uppercase">
                            Pocket Agent
                          </div>
                          {msg.toolSteps && msg.toolSteps.length > 0 && (
                            <div className="flex flex-col gap-1 py-1">
                              {msg.toolSteps.map((step, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                                  <span className="text-[#22d3ee]/30 shrink-0">{toolStepIcon(step.tool)}</span>
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
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 border border-slate-700/60 text-[#22d3ee]/70"
                                >
                                  {c.file}{c.line ? `:${c.line}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(isLoading || replyPhase) && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-[#22d3ee]/70 font-mono tracking-[0.18em] uppercase">Pocket Agent</div>
                    <div className="flex items-center gap-3">
                      {/* The creature reacts in place: thinking while in flight, a tool
                          flare if a connector fired, then a speaking pulse as it lands. */}
                      <Mascot state={mascotState} size={52} noTendrils />
                      <span className={`text-sm text-slate-400 ${replyPhase ? "" : "animate-pulse"}`}>
                        {replyPhase === "tool_calling"
                          ? "Running a tool…"
                          : replyPhase === "responding"
                          ? "Responding…"
                          : replyPhase === "done"
                          ? "Done"
                          : "Working…"}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="px-5 py-4 shrink-0 border-t border-slate-800/60">
              <div className="max-w-2xl mx-auto">
                {!hasApiKey ? (
                  <p className="text-sm text-slate-400 text-center">
                    <a href="/app/settings" className="text-[#22d3ee] hover:underline">Add your Anthropic API key</a>{" "}
                    to continue.
                  </p>
                ) : (
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={textareaRef}
                      rows={2}
                      placeholder="Continue… (⌘↵ to send)"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#22d3ee]/50 focus:outline-none resize-none transition-colors"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isLoading}
                      className="rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 min-h-[44px]"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <HubView
            brainRepo={brainRepo}
            hasApiKey={hasApiKey}
            hasGithubToken={hasGithubToken}
            hasConnection={hasConnection}
            setupBarDismissedAt={setupBarDismissedAt}
            threads={threads}
            scaffolds={scaffolds}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            mascotState={mascotState}
            handleSubmit={handleSubmit}
            handleKeyDown={handleKeyDown}
            textareaRef={textareaRef}
          />
        )}
      </div>
    </div>
  );
}
