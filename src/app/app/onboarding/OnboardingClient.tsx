"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "create"
  | "existing"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "q5"
  | "q6"
  | "committing";

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

// ─── Wizard step definitions ──────────────────────────────────────────────────

type WizardStepDef = {
  id: Step;
  n: number;
  prompt: string;
  helper: string;
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
    helper:
      "Be specific. 'Commercial roofing contractor, Dallas metro' beats 'I run a business.' Your agent reads this before every answer.",
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
    helper:
      "Name the person, not the category. 'Single-family homeowners filing an insurance claim, Dallas metro' is better than 'homeowners.'",
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
    helper:
      "Communication style, how you make decisions, what your agent should and shouldn't do. This is the voice spec for your AI — the more specific, the better.",
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
    helper:
      "List your active projects and priorities. Your agent will know where to focus without you having to say it.",
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
    helper:
      "Things you don't want to re-decide — pricing, positioning, tools, processes. Lock them in here.",
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
    helper:
      "Apps, platforms, software. Anything you want your agent to know is in your stack.",
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

// ─── Shared UI primitives ─────────────────────────────────────────────────────

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

// ─── Create brain step ────────────────────────────────────────────────────────

function CreateStep({
  hasGitHub,
  onCreated,
  onExisting,
  onSkip,
}: {
  hasGitHub: boolean;
  onCreated: (repo: string) => void;
  onExisting: () => void;
  onSkip: () => void;
}) {
  const [repoName, setRepoName] = useState("my-pocket-brain");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const res = await fetch("/api/app/onboarding/fork-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: name }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        repo?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `Failed to create repo (${res.status}). Try again.`);
        return;
      }
      onCreated(body.repo ?? name);
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <StepLabel text="Step 0 — Create your brain" />
        <h1 className="text-2xl font-bold text-slate-100">Build your brain.</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          One click creates a private GitHub repo from the brain template — CLAUDE.md, memory
          files, the full pattern. Then we ask you a few questions to fill it in. Your agent stops
          making you re-explain yourself the minute this is done.
        </p>
      </div>

      {hasGitHub ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Repo name</label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none font-mono"
              placeholder="my-pocket-brain"
              disabled={isPending}
            />
            <p className="text-xs text-slate-600">
              Creates as a private repo in your GitHub account.
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          <PrimaryBtn onClick={handleCreate} disabled={isPending || !repoName.trim()}>
            {isPending ? "Creating your brain…" : "Create my brain →"}
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
        /* Non-GitHub user: show existing repo path */
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-300 font-medium">GitHub not connected</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Creating a brain repo requires a GitHub connection. If you already have a brain repo,
              type it below. Or{" "}
              <a
                href="/api/app/auth/github"
                className="text-[#22d3ee] hover:underline"
              >
                reconnect GitHub
              </a>{" "}
              to create one.
            </p>
          </div>
          <GhostBtn onClick={onExisting}>Connect an existing brain repo →</GhostBtn>
        </div>
      )}

      <div className="border-t border-slate-800 pt-6">
        <p className="text-xs text-slate-600 text-center mb-3">Not ready to set up a brain?</p>
        <GhostBtn onClick={onSkip}>Continue without a brain repo →</GhostBtn>
        <p className="text-xs text-slate-800 text-center mt-2">You can connect one later from home.</p>
      </div>
    </div>
  );
}

// ─── Existing repo step (secondary path) ─────────────────────────────────────

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
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const res = await fetch("/api/app/connect-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setError(b.error ?? "Failed to connect repo. Try again.");
        return;
      }
      onConnected();
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
              disabled={isPending}
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

        <PrimaryBtn onClick={handleConnect} disabled={isPending || !repoInput.trim()}>
          {isPending ? "Connecting…" : "Connect brain →"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Wizard question step ─────────────────────────────────────────────────────

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
    <div className="space-y-6">
      <div className="space-y-1.5">
        <StepLabel text={`Step ${step.n} of 6`} />
        <h2 className="text-xl font-bold text-slate-100">{step.prompt}</h2>
        <p className="text-slate-500 text-xs leading-relaxed">{step.helper}</p>
      </div>

      <div className="space-y-3">
        {step.fields.map((f, idx) => (
          <div key={f.key} className="space-y-1.5">
            {step.fields.length > 1 && (
              <label className="text-xs text-slate-400 font-medium">{f.label}</label>
            )}
            {f.multiline ? (
              <textarea
                ref={idx === 0 ? (el) => { (firstRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el; } : undefined}
                rows={4}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
                value={answers[f.key]}
                onChange={(e) => onUpdate(f.key, e.target.value)}
              />
            ) : (
              <input
                ref={idx === 0 ? (el) => { (firstRef as React.MutableRefObject<HTMLInputElement | null>).current = el; } : undefined}
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

      <div className="space-y-2.5">
        <PrimaryBtn onClick={onNext}>
          {isLast ? "Finish — build my brain →" : "Next →"}
        </PrimaryBtn>
        <div className="text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-600 hover:text-slate-400 underline"
          >
            {isLast ? "Skip — I'll fill this in later →" : "Skip this question →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Committing step ──────────────────────────────────────────────────────────

function CommittingStep({
  answers,
  onError,
  onDone,
}: {
  answers: WizardAnswers;
  onError: (msg: string) => void;
  onDone: () => void;
}) {
  const committed = useRef(false);

  useEffect(() => {
    if (committed.current) return;
    committed.current = true;

    fetch("/api/app/onboarding/wizard-commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    })
      .then(async (res) => {
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string };
          onError(b.error ?? `Failed to build brain (${res.status}). Try again.`);
          return;
        }
        onDone();
      })
      .catch(() => onError("Network error building your brain. Try again."));
  }, [answers, onError, onDone]);

  return (
    <div className="space-y-6 text-center py-6">
      <div className="space-y-2">
        <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase">
          Setting up
        </div>
        <h2 className="text-xl font-bold text-slate-100">Building your brain…</h2>
        <p className="text-slate-500 text-sm">
          Writing your memory files, committing to your repo.
        </p>
      </div>
      <div className="flex justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#22d3ee]/60 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingClient({ hasGitHub }: { hasGitHub: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("create");
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
  const [isSkipping, startSkipTransition] = useTransition();

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

  function handleSkipAll() {
    startSkipTransition(async () => {
      await fetch("/api/app/onboarding/skip", { method: "POST" });
      router.push("/app/ask");
    });
  }

  // After create → go to first wizard question
  function handleBrainCreated(_repo: string) {
    setStep("q1");
  }

  // Existing repo connected → skip wizard, go to /app/ask
  function handleExistingConnected() {
    router.push("/app/ask");
  }

  // Commit done → go to /app/ask
  function handleCommitDone() {
    router.push("/app/ask");
  }

  function handleCommitError(msg: string) {
    setCommitError(msg);
    setStep("q6"); // drop back to last step so they can retry
  }

  const wizardStepDef = WIZARD_STEP_IDS.includes(step)
    ? WIZARD_STEPS.find((s) => s.id === step)
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#05070a] px-4 py-10">
      <div className="w-full max-w-lg space-y-2">
        {/* Maturity bar — visible throughout */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { n: 1, label: "Knows your business" },
            { n: 2, label: "Drafts in your voice" },
            { n: 3, label: "Acts in your tools" },
          ].map((l, i) => (
            <div key={l.n} className="flex items-center shrink-0">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border bg-slate-800 border-slate-700 text-slate-700">
                  {l.n}
                </span>
                <span className="text-[10px] font-medium whitespace-nowrap">{l.label}</span>
              </div>
              {i < 2 && <span className="mx-2 text-slate-800 text-[10px]">→</span>}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === "create" && (
          <CreateStep
            hasGitHub={hasGitHub}
            onCreated={handleBrainCreated}
            onExisting={() => setStep("existing")}
            onSkip={handleSkipAll}
          />
        )}

        {step === "existing" && (
          <ExistingRepoStep
            onBack={() => setStep("create")}
            onConnected={handleExistingConnected}
          />
        )}

        {wizardStepDef && step !== "committing" && (
          <>
            {commitError && (
              <div className="mb-4">
                <ErrorBanner message={commitError} />
                <button
                  type="button"
                  className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline"
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
                className="w-full text-xs text-slate-700 hover:text-slate-500 py-2"
              >
                {isSkipping ? "Setting up…" : "I'll fill this in later — skip to the app →"}
              </button>
            </div>
          </>
        )}

        {step === "committing" && (
          <CommittingStep
            answers={answers}
            onError={handleCommitError}
            onDone={handleCommitDone}
          />
        )}
      </div>
    </main>
  );
}
