"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | "create"
  | "forging"
  | "existing"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "q5"
  | "q6"
  | "committing"
  | "born";

type ForgeStage = "s1" | "s2" | "s3" | "s4" | "done" | "error";

type WizardAnswers = {
  businessName: string;
  whatYouDo: string;
  whoYouServe: string;
  howYouWork: string;
  currentProjects: string;
  keyDecisions: string;
  toolsYouUse: string;
};

type GhRepo = { full_name: string; private: boolean };

// ─── Wizard step definitions ───────────────────────────────────────────────────

type WizardStepDef = {
  id: Step;
  n: number;
  prompt: string;
  helper: string;
  why: string;
  fields: Array<{
    key: keyof WizardAnswers;
    label: string;
    placeholder: string;
    multiline: boolean;
  }>;
};

const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: "q1",
    n: 1,
    prompt: "What's your business called, and what do you actually do?",
    helper: "Be specific — 'Commercial roofing contractor, Dallas metro' beats 'I run a business.'",
    why: "Your agent reads this before every reply. The sharper this context, the less you have to re-explain yourself.",
    fields: [
      {
        key: "businessName",
        label: "Business name",
        placeholder: "e.g. Whited Consulting",
        multiline: false,
      },
      {
        key: "whatYouDo",
        label: "What you do",
        placeholder:
          "e.g. Custom CRMs and AI tooling for contractors. Revenue comes from project builds, not retainers.",
        multiline: true,
      },
    ],
  },
  {
    id: "q2",
    n: 2,
    prompt: "Who do you serve — who's your ideal customer?",
    helper: "Name the person, not the category.",
    why: "Helps your agent write proposals, frame advice, and qualify opportunities — without you specifying who's involved each time.",
    fields: [
      {
        key: "whoYouServe",
        label: "Your ideal customer",
        placeholder:
          "e.g. Contractor business owners running 3–15 crew, no dedicated tech person, managing jobs from their phone.",
        multiline: true,
      },
    ],
  },
  {
    id: "q3",
    n: 3,
    prompt: "How do you like to work?",
    helper: "Communication style, decision-making, what your agent should and shouldn't do.",
    why: "This is the voice spec for your AI. It shapes how your agent drafts, decides, and talks to you. The more specific, the better.",
    fields: [
      {
        key: "howYouWork",
        label: "How I work",
        placeholder:
          "e.g. Direct and short. I don't want lengthy explanations unless I ask. Make a call, don't hedge. Flag blockers, don't hide them.",
        multiline: true,
      },
    ],
  },
  {
    id: "q4",
    n: 4,
    prompt: "What are you working on right now?",
    helper: "List your active projects and priorities.",
    why: "Your agent will know where to focus without you having to say it every time — no context-setting required.",
    fields: [
      {
        key: "currentProjects",
        label: "Current projects and priorities",
        placeholder:
          "e.g. \n- Patrick's CRM: final handoff, two items left\n- Pocket Agent: Phase 1 launch\n- Dispatch Playbook: shipping next week",
        multiline: true,
      },
    ],
  },
  {
    id: "q5",
    n: 5,
    prompt: "Any decisions you've made that your agent should know?",
    helper: "Things you don't want to re-decide — pricing, positioning, tools, processes.",
    why: "Lock them in here. Your agent won't ask you to revisit what's already settled.",
    fields: [
      {
        key: "keyDecisions",
        label: "Key decisions",
        placeholder:
          "e.g. \n- Not taking on residential clients\n- BYO API key model, not a hosted AI subscription\n- No equity deals",
        multiline: true,
      },
    ],
  },
  {
    id: "q6",
    n: 6,
    prompt: "What tools do you use daily?",
    helper: "Apps, platforms, software. Anything you want your agent to know is in your stack.",
    why: "So your agent can reference the right tools — not suggest ones you're not using.",
    fields: [
      {
        key: "toolsYouUse",
        label: "Tools I use",
        placeholder:
          "e.g. Claude Code, Supabase, Vercel, Stripe, Resend, Notion, GitHub, Linear",
        multiline: true,
      },
    ],
  },
];

const WIZARD_STEP_IDS: Step[] = ["q1", "q2", "q3", "q4", "q5", "q6"];

// ─── Forge stage config ────────────────────────────────────────────────────────

const FORGE_STAGES: { id: ForgeStage; label: string; subLabel: string }[] = [
  { id: "s1", label: "Probing your repo structure",     subLabel: "Mapping neural entry points" },
  { id: "s2", label: "Crawling your memory files",       subLabel: "Agent reading file by file" },
  { id: "s3", label: "Absorbing your business context",  subLabel: "Encoding into long-term memory" },
  { id: "s4", label: "Your agent is waking up",          subLabel: "Consciousness loading" },
];

const SCAN_FILES = [
  "AGENTS.md",
  "memory/user_about-the-business.md",
  "memory/user_who-i-serve.md",
  "memory/feedback_how-i-work.md",
  "memory/project_current-priorities.md",
  "memory/project_key-decisions.md",
  "memory/reference_tools.md",
  "CLAUDE.md",
];

// Tendril endpoints in a 300×200 SVG (centre 150, 96)
const TENDRILS = [
  { x1: 48,  y1: 20,  cpx: 95,  cpy: 52,  delay: 0    },
  { x1: 210, y1: 18,  cpx: 175, cpy: 50,  delay: 0.25 },
  { x1: 266, y1: 88,  cpx: 215, cpy: 90,  delay: 0.1  },
  { x1: 218, y1: 172, cpx: 188, cpy: 142, delay: 0.35 },
  { x1: 72,  y1: 178, cpx: 108, cpy: 148, delay: 0.15 },
  { x1: 34,  y1: 96,  cpx: 88,  cpy: 96,  delay: 0.2  },
];

// Particles starting offset from centre (matched to tendril tips)
const PARTICLES: { x: number; y: number; delay: number; dur: number }[] = [
  { x: -82, y: -60, delay: 0,    dur: 2.2 },
  { x:  62, y: -68, delay: 0.4,  dur: 2.0 },
  { x: 100, y:  -4, delay: 0.8,  dur: 2.4 },
  { x:  68, y:  70, delay: 0.2,  dur: 2.1 },
  { x: -62, y:  78, delay: 0.6,  dur: 2.3 },
  { x: -95, y:   2, delay: 1.0,  dur: 2.0 },
  { x: -48, y: -54, delay: 0.3,  dur: 2.5 },
  { x:  52, y: -50, delay: 0.7,  dur: 2.2 },
];

const STAGE_DURATIONS: Partial<Record<ForgeStage, number>> = {
  s1: 1900,
  s2: 1900,
  s3: 1700,
};

const STAGE_PCT: Partial<Record<ForgeStage, number>> = {
  s1: 12,
  s2: 38,
  s3: 65,
  s4: 88,
  done: 100,
};

// ─── Shared UI primitives ──────────────────────────────────────────────────────

function StepLabel({ text }: { text: string }) {
  return (
    <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase mb-2">
      {text}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  );
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function GhostBtn({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function WhyCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[#22d3ee]/15 bg-[#22d3ee]/5 px-3 py-2.5 flex gap-2.5 items-start">
      <span className="text-[#22d3ee]/70 text-[9px] font-mono tracking-[0.12em] uppercase shrink-0 mt-0.5 pt-px">
        WHY
      </span>
      <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}

function SkipNote({ onSkip, isLast }: { onSkip: () => void; isLast?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onSkip}
        className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
      >
        {isLast ? "Skip — I'll add this later" : "I'll add this later →"}
      </button>
      <p className="text-[10px] text-slate-700 text-center max-w-xs">
        Nothing&apos;s required. Best to do it now — your agent starts useful immediately.
      </p>
    </div>
  );
}

function WizardProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div
          key={n}
          className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
            n < current
              ? "bg-[#22d3ee]"
              : n === current
              ? "bg-[#22d3ee]/50"
              : "bg-slate-800"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Alien entity (central creature — used in born/committing/done) ───────────

function AlienEntity({ awake = false }: { awake?: boolean }) {
  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: 80, height: 80 }}>
      {/* Periodic halo expansion */}
      <div
        className="absolute inset-0 rounded-full border border-[#22d3ee]/20 pointer-events-none"
        style={{ animation: "halo-out 4s ease-out 1s infinite" }}
      />
      <div
        className="absolute inset-0 rounded-full border border-[#22d3ee]/10 pointer-events-none"
        style={{ animation: "halo-out 4s ease-out 2.5s infinite" }}
      />
      {/* Morphing organic body */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: awake
            ? "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0.06) 55%, transparent 100%)"
            : "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.10) 0%, rgba(34,211,238,0.02) 55%, transparent 100%)",
          boxShadow: awake
            ? "0 0 28px rgba(34,211,238,0.28), inset 0 0 18px rgba(34,211,238,0.08)"
            : "0 0 10px rgba(34,211,238,0.10)",
          animation: "alien-morph 6s ease-in-out infinite",
          transition: "box-shadow 1.2s ease, background 1.2s ease",
        }}
      />
      {/* Iris / eye */}
      <div className="relative z-10 flex items-center justify-center">
        {awake ? (
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "radial-gradient(circle, #e2feff 0%, #22d3ee 45%, rgba(34,211,238,0.3) 100%)",
              boxShadow: "0 0 10px 4px rgba(34,211,238,0.55), 0 0 22px rgba(34,211,238,0.25)",
              animation: "iris-wake 0.9s ease-out forwards",
            }}
          />
        ) : (
          <div
            className="animate-pulse"
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(34,211,238,0.8) 0%, rgba(34,211,238,0.15) 100%)",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Alien forge visual (tendrils + particles + file scan) ────────────────────

function AlienForgeVisual({ stage }: { stage: ForgeStage | "checking" | "writing" | "finalizing" }) {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  // Map commit stages to forge stages for visual purposes
  const vs: ForgeStage =
    stage === "checking"   ? "s1" :
    stage === "writing"    ? "s2" :
    stage === "finalizing" ? "s3" :
    (stage as ForgeStage);

  const isScanning = vs === "s2" || vs === "s3";
  const isDone     = vs === "done";
  const isActive   = vs !== "error" && !isDone;

  const stageOrder: ForgeStage[] = ["s1", "s2", "s3", "s4"];
  const currentIdx = stageOrder.indexOf(vs);
  const tendrilsRevealed = currentIdx >= 0;

  useEffect(() => {
    if (!isScanning) { setCurrentFile(null); return; }
    let i = 0;
    setCurrentFile(SCAN_FILES[0]);
    const t = setInterval(() => {
      i = (i + 1) % SCAN_FILES.length;
      setCurrentFile(SCAN_FILES[i]);
      setFileKey((k) => k + 1);
    }, 680);
    return () => clearInterval(t);
  }, [isScanning]);

  return (
    <div className="relative h-52 w-full flex items-center justify-center overflow-hidden">
      {/* Horizontal scan sweep */}
      {isActive && (
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            height: 1,
            background:
              "linear-gradient(to right, transparent 0%, rgba(34,211,238,0.18) 30%, rgba(34,211,238,0.38) 50%, rgba(34,211,238,0.18) 70%, transparent 100%)",
            animation: "scan-sweep 5s linear infinite",
          }}
        />
      )}

      {/* SVG tendril layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {TENDRILS.map((t, i) => (
          <g key={i}>
            <path
              d={`M 150 96 Q ${t.cpx} ${t.cpy} ${t.x1} ${t.y1}`}
              stroke="#22d3ee"
              strokeWidth={isDone ? "1" : "0.7"}
              fill="none"
              strokeDasharray="140"
              strokeDashoffset={tendrilsRevealed ? "0" : "140"}
              style={{
                transition: `stroke-dashoffset 1.6s ease-out ${t.delay}s`,
                animation: "tendril-pulse 3s ease-in-out infinite",
                animationDelay: `${t.delay * 1.8}s`,
              }}
            />
            {tendrilsRevealed && (
              <circle
                cx={t.x1}
                cy={t.y1}
                r={isScanning ? 2.5 : 1.5}
                fill="#22d3ee"
                fillOpacity={isDone ? 0.7 : 0.28}
                style={{ animation: "tendril-pulse 2.5s ease-in-out infinite", animationDelay: `${t.delay}s` }}
              />
            )}
          </g>
        ))}
      </svg>

      {/* Inward-flowing particles */}
      {(isActive || isDone) &&
        PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={
              {
                width: 3,
                height: 3,
                top: "50%",
                left: "50%",
                marginTop: -1.5,
                marginLeft: -1.5,
                background: "radial-gradient(circle, #22d3ee 0%, rgba(34,211,238,0.4) 100%)",
                "--px": `${p.x}px`,
                "--py": `${p.y}px`,
                animation: `particle-in ${p.dur}s ease-in ${p.delay}s infinite`,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Central entity */}
      <div className="relative z-10">
        <AlienEntity awake={isDone} />
      </div>

      {/* File scan status line */}
      <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none" style={{ height: 16 }}>
        {currentFile ? (
          <span
            key={fileKey}
            className="text-[9px] font-mono text-[#22d3ee]/40 select-none"
            style={{ animation: "file-flash 0.68s ease-out forwards" }}
          >
            ◈ {currentFile}
          </span>
        ) : vs === "s1" ? (
          <span className="text-[9px] font-mono text-slate-700 animate-pulse select-none">
            probing structure…
          </span>
        ) : vs === "s4" ? (
          <span className="text-[9px] font-mono text-[#22d3ee]/25 animate-pulse select-none">
            consciousness loading…
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Forge screen (replaces the instant fork+redirect) ─────────────────────────

function ForgeScreen({
  repoName,
  apiPromise,
  onCreated,
  onBack,
}: {
  repoName: string;
  apiPromise: Promise<Response>;
  onCreated: (repo: string) => void;
  onBack: (error: string) => void;
}) {
  const [stage, setStage] = useState<ForgeStage>("s1");
  const [apiResult, setApiResult] = useState<
    null | { ok: true; repo: string } | { ok: false; error: string }
  >(null);
  const [forgeRepo, setForgeRepo] = useState("");
  const onCreatedRef = useRef(onCreated);
  const onBackRef = useRef(onBack);
  onCreatedRef.current = onCreated;
  onBackRef.current = onBack;

  // Resolve the API promise (passed in, so no double-invoke risk)
  useEffect(() => {
    let active = true;
    apiPromise
      .then(async (res) => {
        if (!active) return;
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          repo?: string;
          error?: string;
        };
        if (!res.ok) {
          setApiResult({
            ok: false,
            error: body.error ?? `Failed to create repo (${res.status}). Try again.`,
          });
        } else {
          const repo = body.repo ?? repoName;
          setForgeRepo(repo);
          setApiResult({ ok: true, repo });
        }
      })
      .catch(() => {
        if (!active) setApiResult({ ok: false, error: "Network error. Try again." });
      });
    return () => {
      active = false;
    };
  }, [apiPromise, repoName]);

  // Stage timers: s1→s2→s3→s4 with minimum hold durations
  useEffect(() => {
    if (stage === "s1") {
      const t = setTimeout(() => setStage("s2"), STAGE_DURATIONS.s1!);
      return () => clearTimeout(t);
    }
    if (stage === "s2") {
      const t = setTimeout(() => setStage("s3"), STAGE_DURATIONS.s2!);
      return () => clearTimeout(t);
    }
    if (stage === "s3") {
      const t = setTimeout(() => setStage("s4"), STAGE_DURATIONS.s3!);
      return () => clearTimeout(t);
    }
  }, [stage]);

  // If API fails during any stage, interrupt to error immediately
  useEffect(() => {
    if (apiResult?.ok === false && stage !== "error" && stage !== "done") {
      setStage("error");
    }
  }, [apiResult, stage]);

  // s4: wait for API, then advance to done
  useEffect(() => {
    if (stage !== "s4" || apiResult === null) return;
    if (!apiResult.ok) return;
    const t = setTimeout(() => setStage("done"), 600);
    return () => clearTimeout(t);
  }, [stage, apiResult]);

  // done: transition to wizard after a moment
  useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(() => onCreatedRef.current(forgeRepo), 1100);
    return () => clearTimeout(t);
  }, [stage, forgeRepo]);

  const stageOrder: ForgeStage[] = ["s1", "s2", "s3", "s4"];
  const currentIdx = stageOrder.indexOf(stage as ForgeStage);
  const pct = STAGE_PCT[stage] ?? 0;

  if (stage === "error") {
    const errMsg =
      apiResult?.ok === false ? apiResult.error : "Something went wrong. Try again.";
    return (
      <div className="space-y-6 text-center py-10">
        <div className="space-y-2">
          <div className="text-red-400 text-xs font-mono tracking-[0.2em] uppercase">Forge Failed</div>
          <h2 className="text-lg font-bold text-slate-100">Brain creation failed</h2>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">{errMsg}</p>
        </div>
        <button
          type="button"
          onClick={() => onBackRef.current(errMsg)}
          className="text-[#22d3ee] text-sm hover:underline transition-colors"
        >
          ← Try again
        </button>
      </div>
    );
  }

  const STAGE_HEADERS: Partial<Record<ForgeStage, string>> = {
    s1: "Crawling your brain…",
    s2: "Reading your files…",
    s3: "Absorbing your context…",
    s4: "Your agent is waking up…",
    done: "Your agent is alive.",
  };

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <StepLabel text="POCKET AGENT" />
        <h1 className="text-xl font-bold text-slate-100">
          {STAGE_HEADERS[stage] ?? "Forging your second brain…"}
        </h1>
        <p className="text-xs text-slate-600">
          {stage === "done" ? "Entering your second brain…" : `Creating ${repoName}`}
        </p>
      </div>

      {/* Alien forge visual */}
      <AlienForgeVisual stage={stage} />

      {/* Stage list */}
      <div className="space-y-3">
        {FORGE_STAGES.map(({ id, label, subLabel }, i) => {
          const stageIdx = stageOrder.indexOf(id);
          const isDone = stage === "done" || stageIdx < currentIdx;
          const isActive = id === stage;
          const isPending = stageIdx > currentIdx && stage !== "done";

          return (
            <div
              key={id}
              className={`flex items-center gap-3 transition-all duration-500 ${isPending ? "opacity-25" : "opacity-100"}`}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full border shrink-0 transition-all duration-300 ${
                  isDone
                    ? "border-[#22d3ee] bg-[#22d3ee]/20 text-[#22d3ee]"
                    : isActive
                    ? "border-[#22d3ee]/60 bg-[#22d3ee]/10 text-[#22d3ee]/80"
                    : "border-slate-700 bg-slate-900 text-slate-700"
                }`}
              >
                {isDone ? (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
                    <path
                      d="M1.5 5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-current" />
                )}
              </span>

              <div className="min-w-0">
                <div
                  className={`text-sm font-medium transition-colors duration-300 ${
                    isDone ? "text-[#22d3ee]" : isActive ? "text-slate-200" : "text-slate-600"
                  }`}
                >
                  {label}
                </div>
                {isActive && (
                  <div className="text-[10px] text-slate-600 mt-0.5 font-mono animate-pulse">
                    {subLabel}
                  </div>
                )}
                {isDone && i < 3 && (
                  <div className="text-[10px] text-[#22d3ee]/40 mt-0.5 font-mono">done</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-1 bg-slate-800/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#22d3ee]/80 to-[#22d3ee] rounded-full"
            style={{
              width: `${pct}%`,
              transition: "width 1400ms ease-in-out",
            }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-700 font-mono">
            {stage === "done" ? "COMPLETE" : "INITIALIZING"}
          </span>
          <span className="text-[10px] text-[#22d3ee]/60 font-mono">{pct}%</span>
        </div>
      </div>

      {stage === "done" && (
        <div className="text-center py-2">
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.25em] uppercase animate-pulse">
            SYSTEM ONLINE — BRAIN READY
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create brain step ─────────────────────────────────────────────────────────

function CreateStep({
  hasGitHub,
  onForging,
  onExisting,
  onSkip,
  initialError = null,
}: {
  hasGitHub: boolean;
  onForging: (name: string, promise: Promise<Response>) => void;
  onExisting: () => void;
  onSkip: () => void;
  initialError?: string | null;
}) {
  const [repoName, setRepoName] = useState("my-pocket-brain");
  const [error, setError] = useState<string | null>(initialError);
  const [isStarting, setIsStarting] = useState(false);

  function handleCreate() {
    const name = repoName.trim();
    if (!name) {
      setError("Enter a repo name.");
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(name)) {
      setError(
        "Repo name must start with a letter or number and contain only letters, numbers, dashes, underscores, or dots.",
      );
      return;
    }
    setError(null);
    setIsStarting(true);

    // Start the API call immediately — pass the Promise to ForgeScreen
    const promise = fetch("/api/app/onboarding/fork-brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName: name }),
    });

    onForging(name, promise);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <StepLabel text="Step 0 — Create your brain" />
        <h1 className="text-2xl font-bold text-slate-100">
          Build your AI second brain.
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          One click forks a private GitHub repo — your agent&apos;s memory, voice spec, and operating
          rules, all in one place. Then we ask you 6 quick questions to fill it in.
        </p>

        <WhyCard text="Your brain is what makes Pocket Agent actually know your business. Without it, it's just another chatbot. With it, it remembers your context, works in your voice, and stops making you re-explain yourself." />
      </div>

      {hasGitHub ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300 font-medium">Name your brain repo</label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStarting && handleCreate()}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none font-mono"
              placeholder="my-pocket-brain"
              disabled={isStarting}
            />
            <p className="text-xs text-slate-600">
              Creates as a private repo in your GitHub account. You own it forever.
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          <PrimaryBtn onClick={handleCreate} disabled={isStarting || !repoName.trim()}>
            {isStarting ? "Starting forge…" : "Forge my brain →"}
          </PrimaryBtn>

          <div className="text-center">
            <button
              type="button"
              onClick={onExisting}
              className="text-xs text-slate-600 hover:text-slate-400 underline"
            >
              I already have a brain repo →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-300 font-medium">GitHub not connected</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Creating a brain repo requires a GitHub connection.{" "}
              <a href="/api/app/auth/github" className="text-[#22d3ee] hover:underline">
                Connect GitHub
              </a>{" "}
              to continue, or connect an existing brain repo below.
            </p>
          </div>
          <GhostBtn onClick={onExisting}>Connect an existing brain repo →</GhostBtn>
        </div>
      )}

      <div className="border-t border-slate-800 pt-5">
        <p className="text-xs text-slate-600 text-center mb-3">Not ready yet?</p>
        <GhostBtn onClick={onSkip}>Continue without a brain for now →</GhostBtn>
        <p className="text-[11px] text-slate-700 text-center mt-2">
          You can connect one from home at any time.
        </p>
      </div>
    </div>
  );
}

// ─── Existing repo step ────────────────────────────────────────────────────────

function ExistingRepoStep({
  onBack,
  onConnected,
}: {
  onBack: () => void;
  onConnected: () => void;
}) {
  const [repos, setRepos] = useState<GhRepo[]>([]);
  const [repoInput, setRepoInput] = useState("");
  const [mode, setMode] = useState<"dropdown" | "manual">("dropdown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    fetch("/api/app/github/repos")
      .then((r) => (r.ok ? (r.json() as Promise<GhRepo[]>) : Promise.reject()))
      .then((data) => {
        setRepos(data);
        setLoading(false);
        if (data.length === 0) setMode("manual");
      })
      .catch(() => {
        setLoading(false);
        setMode("manual");
      });
  }, []);

  function handleConnect() {
    const repo = repoInput.trim();
    if (!repo || !repo.includes("/")) {
      setError("Enter a repo in owner/name format.");
      return;
    }
    setError(null);
    setIsConnecting(true);
    fetch("/api/app/connect-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string };
          setError(b.error ?? "Failed to connect repo. Try again.");
          setIsConnecting(false);
          return;
        }
        onConnected();
      })
      .catch(() => {
        setError("Network error. Try again.");
        setIsConnecting(false);
      });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-600 hover:text-slate-400 underline mb-1"
        >
          ← Back
        </button>
        <StepLabel text="Existing brain repo" />
        <h1 className="text-2xl font-bold text-slate-100">Connect your brain repo.</h1>
        <p className="text-slate-400 text-sm">
          Pick or type the GitHub repo that holds your{" "}
          <code className="text-[#22d3ee] text-xs bg-slate-800/60 px-1 py-0.5 rounded">
            memory/
          </code>{" "}
          folder.
        </p>
      </div>

      <div className="space-y-3">
        {!loading && mode === "dropdown" && repos.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Choose a repo</label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-[#22d3ee] focus:outline-none"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
            >
              <option value="">— Select a repo —</option>
              {repos.map((r) => (
                <option key={r.full_name} value={r.full_name}>
                  {r.full_name} {r.private ? "🔒" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs text-slate-600 hover:text-slate-400 underline"
              onClick={() => {
                setMode("manual");
                setRepoInput("");
              }}
            >
              Type a repo name instead
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Brain repo (owner/name)</label>
            <input
              type="text"
              placeholder="yourname/my-brain"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              disabled={isConnecting}
            />
            {!loading && repos.length > 0 && (
              <button
                type="button"
                className="text-xs text-slate-600 hover:text-slate-400 underline"
                onClick={() => {
                  setMode("dropdown");
                  setRepoInput("");
                }}
              >
                Pick from my repos instead
              </button>
            )}
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <PrimaryBtn onClick={handleConnect} disabled={isConnecting || !repoInput.trim()}>
          {isConnecting ? "Connecting…" : "Connect brain →"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Wizard question step ──────────────────────────────────────────────────────

function WizardStep({
  step,
  answers,
  onUpdate,
  onNext,
  onSkip,
}: {
  step: WizardStepDef;
  answers: WizardAnswers;
  onUpdate: (key: keyof WizardAnswers, value: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const firstRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    (firstRef.current as HTMLElement | null)?.focus();
  }, [step.id]);

  const isLast = step.id === "q6";

  return (
    <div className="space-y-5">
      <WizardProgressBar current={step.n} />

      <div className="space-y-1.5">
        <StepLabel text={`Question ${step.n} of 6`} />
        <h2 className="text-xl font-bold text-slate-100">{step.prompt}</h2>
        <p className="text-slate-500 text-xs leading-relaxed">{step.helper}</p>
      </div>

      <WhyCard text={step.why} />

      <div className="space-y-3">
        {step.fields.map((f, idx) => (
          <div key={f.key} className="space-y-1.5">
            {step.fields.length > 1 && (
              <label className="text-xs text-slate-400 font-medium">{f.label}</label>
            )}
            {f.multiline ? (
              <textarea
                ref={
                  idx === 0
                    ? (el) => {
                        (
                          firstRef as React.MutableRefObject<HTMLTextAreaElement | null>
                        ).current = el;
                      }
                    : undefined
                }
                rows={4}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
                value={answers[f.key]}
                onChange={(e) => onUpdate(f.key, e.target.value)}
              />
            ) : (
              <input
                ref={
                  idx === 0
                    ? (el) => {
                        (
                          firstRef as React.MutableRefObject<HTMLInputElement | null>
                        ).current = el;
                      }
                    : undefined
                }
                type="text"
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
                value={answers[f.key]}
                onChange={(e) => onUpdate(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <PrimaryBtn onClick={onNext}>
          {isLast ? "Build my brain →" : "Next →"}
        </PrimaryBtn>
        <SkipNote onSkip={onSkip} isLast={isLast} />
      </div>
    </div>
  );
}

// ─── Committing step ───────────────────────────────────────────────────────────

type CommitStage = "checking" | "writing" | "finalizing" | "done" | "error";

function CommittingStep({
  answers,
  onError,
  onDone,
}: {
  answers: WizardAnswers;
  onError: (msg: string) => void;
  onDone: () => void;
}) {
  const [commitStage, setCommitStage] = useState<CommitStage>("checking");
  const committed = useRef(false);
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  onDoneRef.current = onDone;
  onErrorRef.current = onError;

  useEffect(() => {
    if (committed.current) return;
    committed.current = true;

    const advanceStage = (stage: CommitStage, delay: number) =>
      new Promise<void>((resolve) => setTimeout(() => { setCommitStage(stage); resolve(); }, delay));

    async function run() {
      await advanceStage("writing", 900);

      const fetchPromise = fetch("/api/app/onboarding/wizard-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      await advanceStage("finalizing", 1600);

      const res = await fetchPromise.catch(() => null);
      if (!res || !res.ok) {
        const b = res
          ? ((await res.json().catch(() => ({}))) as { error?: string })
          : {};
        onErrorRef.current(b.error ?? `Failed to build brain${res ? ` (${res.status})` : ""}. Try again.`);
        return;
      }

      await advanceStage("done", 400);
      setTimeout(() => onDoneRef.current(), 800);
    }

    run().catch(() =>
      onErrorRef.current("Network error building your brain. Try again."),
    );
  }, [answers]);

  const COMMIT_HEADERS: Partial<Record<CommitStage, string>> = {
    checking:   "Probing your brain repo…",
    writing:    "Writing your memories…",
    finalizing: "Your agent is absorbing…",
    done:       "Your agent knows everything.",
  };

  const stages: { id: CommitStage; label: string }[] = [
    { id: "checking",   label: "Probing brain repo"       },
    { id: "writing",    label: "Writing memory files"     },
    { id: "finalizing", label: "Absorbing into the agent" },
    { id: "done",       label: "Context locked in"        },
  ];

  const stageOrder: CommitStage[] = ["checking", "writing", "finalizing", "done"];
  const currentIdx = stageOrder.indexOf(commitStage);

  return (
    <div className="space-y-6 text-center py-6">
      <div className="space-y-1">
        <StepLabel text="POCKET AGENT" />
        <h2 className="text-xl font-bold text-slate-100">
          {COMMIT_HEADERS[commitStage] ?? "Building your brain…"}
        </h2>
        <p className="text-slate-600 text-sm">Encoding your context into memory.</p>
      </div>

      <AlienForgeVisual stage={commitStage} />

      <div className="space-y-2.5 text-left">
        {stages.map(({ id, label }, i) => {
          const isDone = stageOrder.indexOf(id) < currentIdx || commitStage === "done";
          const isActive = id === commitStage && commitStage !== "done";
          const isPending = stageOrder.indexOf(id) > currentIdx && commitStage !== "done";

          return (
            <div
              key={id}
              className={`flex items-center gap-3 transition-all duration-400 ${isPending ? "opacity-30" : "opacity-100"}`}
            >
              <span
                className={`flex items-center justify-center w-4 h-4 rounded-full border shrink-0 transition-all duration-300 text-[9px] ${
                  isDone
                    ? "border-[#22d3ee] bg-[#22d3ee]/20 text-[#22d3ee]"
                    : isActive
                    ? "border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#22d3ee]/70"
                    : "border-slate-700 bg-slate-900 text-slate-700"
                }`}
              >
                {isDone ? (
                  <svg className="w-2 h-2" fill="none" viewBox="0 0 10 10">
                    <path
                      d="M1.5 5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : isActive ? (
                  <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                ) : (
                  <span className="w-0.5 h-0.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`text-sm transition-colors duration-300 ${
                  isDone ? "text-[#22d3ee]" : isActive ? "text-slate-200" : "text-slate-600"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Brain born screen (post-commit plain-language summary) ────────────────────

function BrainBornScreen({
  repo,
  answers,
  isUpdate,
  onEnter,
}: {
  repo: string;
  answers: WizardAnswers;
  isUpdate: boolean;
  onEnter: () => void;
}) {
  const memoryAreas = [
    {
      key: "business",
      label: "Your business",
      desc: "What you do, who you are",
      filled: Boolean(answers.businessName.trim() || answers.whatYouDo.trim()),
    },
    {
      key: "customers",
      label: "Who you serve",
      desc: "Your ideal customer",
      filled: Boolean(answers.whoYouServe.trim()),
    },
    {
      key: "style",
      label: "How you work",
      desc: "Your voice spec",
      filled: Boolean(answers.howYouWork.trim()),
    },
    {
      key: "projects",
      label: "Current projects",
      desc: "Active priorities",
      filled: Boolean(answers.currentProjects.trim()),
    },
    {
      key: "decisions",
      label: "Key decisions",
      desc: "Locked in, not revisited",
      filled: Boolean(answers.keyDecisions.trim()),
    },
    {
      key: "tools",
      label: "Tools & stack",
      desc: "Your daily software",
      filled: Boolean(answers.toolsYouUse.trim()),
    },
  ];

  const filledCount = memoryAreas.filter((a) => a.filled).length;

  return (
    <div className="space-y-7 py-3">
      {/* Success visual */}
      <div className="text-center space-y-3">
        <AlienEntity awake />
        <div>
          <div className="text-[#22d3ee] text-[10px] font-mono tracking-[0.25em] uppercase mb-1.5">
            {isUpdate ? "AGENT UPDATED" : "AGENT ONLINE"}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {isUpdate ? "Your agent absorbed the update." : "Your agent is alive."}
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed max-w-xs mx-auto">
            Private GitHub repo. It&apos;s yours — not on our servers, not locked to any platform.
          </p>
        </div>
      </div>

      {/* What your agent knows */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden divide-y divide-slate-800/60">
        {/* Memory section */}
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]/60" />
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.15em] uppercase">
              Memory — what your agent remembers
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {memoryAreas.map((area) => (
              <div
                key={area.key}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg ${
                  area.filled
                    ? "text-slate-300 bg-slate-800/40"
                    : "text-slate-600 bg-transparent border border-dashed border-slate-800/50"
                }`}
              >
                <span className={area.filled ? "text-[#22d3ee] text-xs" : "text-slate-700 text-xs"}>
                  {area.filled ? "✓" : "○"}
                </span>
                <span className="truncate">{area.label}</span>
              </div>
            ))}
          </div>
          {filledCount < 6 && (
            <p className="text-[10px] text-slate-600 mt-2.5 leading-relaxed">
              {6 - filledCount} area{6 - filledCount !== 1 ? "s" : ""} empty — you can fill them in from the home screen anytime.
            </p>
          )}
        </div>

        {/* Rules section */}
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.15em] uppercase">
              Rules — how your agent works
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Voice spec, thinking patterns, and operating rules — already loaded. These shape how your agent writes, decides, and communicates.
          </p>
        </div>

        {/* Repo section */}
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.15em] uppercase">
              Location — your private repo
            </span>
          </div>
          <p className="text-xs font-mono text-[#22d3ee]/70 break-all">{repo}</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Private. Yours forever. No vendor lock-in.
          </p>
        </div>
      </div>

      <PrimaryBtn onClick={onEnter}>
        Enter your brain →
      </PrimaryBtn>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OnboardingClient({
  hasGitHub,
  updateMode = false,
  brainRepo = null,
}: {
  hasGitHub: boolean;
  updateMode?: boolean;
  brainRepo?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(updateMode ? "q1" : "create");
  const [answers, setAnswers] = useState<WizardAnswers>({
    businessName: "",
    whatYouDo: "",
    whoYouServe: "",
    howYouWork: "",
    currentProjects: "",
    keyDecisions: "",
    toolsYouUse: "",
  });
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

  // forge state
  const [forgeRepoName, setForgeRepoName] = useState("");
  const [forgeApiPromise, setForgeApiPromise] = useState<Promise<Response> | null>(null);
  const [forgedRepo, setForgedRepo] = useState(brainRepo ?? "");
  const [forgeBackError, setForgeBackError] = useState<string | null>(null);

  function updateAnswer(key: keyof WizardAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function advanceWizard(current: Step) {
    const idx = WIZARD_STEP_IDS.indexOf(current);
    if (idx === -1 || idx === WIZARD_STEP_IDS.length - 1) {
      setStep("committing");
    } else {
      setStep(WIZARD_STEP_IDS[idx + 1]);
    }
  }

  const handleSkipAll = useCallback(async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    try {
      await fetch("/api/app/onboarding/skip", { method: "POST" });
    } finally {
      router.push("/app/ask");
    }
  }, [isSkipping, router]);

  function handleStartForge(name: string, promise: Promise<Response>) {
    setForgeRepoName(name);
    setForgeApiPromise(promise);
    setStep("forging");
  }

  function handleForgeBack(errorMsg: string) {
    setForgeBackError(errorMsg);
    setStep("create");
  }

  function handleBrainForged(repo: string) {
    setForgedRepo(repo);
    setStep("q1");
  }

  function handleExistingConnected() {
    router.push("/app/ask");
  }

  function handleCommitDone() {
    setStep("born");
  }

  function handleCommitError(msg: string) {
    setCommitError(msg);
    setStep("q6");
  }

  const wizardStepDef = WIZARD_STEP_IDS.includes(step)
    ? WIZARD_STEPS.find((s) => s.id === step)
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#05070a] px-4 py-10">
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(34,211,238,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-lg">
        {/* Maturity indicator (collapsed, just branding) */}
        {(step === "create" || step === "existing") && (
          <div className="mb-8 flex items-center justify-center gap-1.5 text-slate-700">
            <div className="w-1 h-1 rounded-full bg-[#22d3ee]/30" />
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-700">
              Pocket Agent · Brain Setup
            </span>
            <div className="w-1 h-1 rounded-full bg-[#22d3ee]/30" />
          </div>
        )}

        {/* Step content */}
        {step === "create" && (
          <CreateStep
            hasGitHub={hasGitHub}
            onForging={handleStartForge}
            onExisting={() => setStep("existing")}
            onSkip={handleSkipAll}
            initialError={forgeBackError}
          />
        )}

        {step === "forging" && forgeApiPromise && (
          <ForgeScreen
            repoName={forgeRepoName}
            apiPromise={forgeApiPromise}
            onCreated={handleBrainForged}
            onBack={handleForgeBack}
          />
        )}

        {step === "existing" && (
          <ExistingRepoStep
            onBack={() => setStep("create")}
            onConnected={handleExistingConnected}
          />
        )}

        {wizardStepDef && step !== "committing" && (
          <div className="space-y-4">
            {commitError && (
              <div className="mb-4 space-y-2">
                <ErrorBanner message={commitError} />
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-300 underline"
                  onClick={() => {
                    setCommitError(null);
                    setStep("committing");
                  }}
                >
                  Retry →
                </button>
              </div>
            )}
            <WizardStep
              step={wizardStepDef}
              answers={answers}
              onUpdate={updateAnswer}
              onNext={() => advanceWizard(step)}
              onSkip={() => advanceWizard(step)}
            />
            <div className="pt-4 border-t border-slate-800/60">
              <button
                type="button"
                onClick={handleSkipAll}
                disabled={isSkipping}
                className="w-full text-xs text-slate-700 hover:text-slate-500 py-2 transition-colors"
              >
                {isSkipping ? "Setting up…" : "Skip everything — I'll fill this in later →"}
              </button>
            </div>
          </div>
        )}

        {step === "committing" && (
          <CommittingStep
            answers={answers}
            onError={handleCommitError}
            onDone={handleCommitDone}
          />
        )}

        {step === "born" && (
          <BrainBornScreen
            repo={forgedRepo}
            answers={answers}
            isUpdate={updateMode}
            onEnter={() => router.push("/app/ask")}
          />
        )}
      </div>
    </main>
  );
}
