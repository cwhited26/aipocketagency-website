"use client";

// The Agent Builder hero box (PA-POS-28 — the marketing surface of PA-POS-27, placement per
// PA-POS-34). The owner describes the agent they need; the box previews what Pocket Agent
// would compose from the real catalogs (client-side keyword match, no LLM call). The Compose
// button routes a signed-in owner — ANY tier; composing has no tier gate — to the Library
// create surface at /agents#compose with the spec; everyone else carries the spec into signup
// at /start?intent=agent-builder. The real composition runs inside the workspace and stages
// for approval before anything runs. The page stays static — the signed-in check is one
// client fetch after mount, defaulting to the signup route on any failure.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { MONO_FONT } from "./cta";
import { MOTION_LAYER, useMotionPaused } from "./motion-pref";
import {
  matchSpec,
  type ComposeCategory,
  type ComposeData,
  type ComposePreview,
} from "@/lib/marketing/compose-preview";
import { saveAgentIdea } from "@/lib/marketing/agent-idea-store";
import { pocArtSrc } from "@/lib/personas/poc-variants";

const PLACEHOLDERS = [
  "An agent that watches Gmail for adjuster emails and drafts SRA responses in my voice.",
  "A weekly Ritual that summarizes my pipeline and stages 3 outreach drafts every Monday at 8am.",
  "An agent that scans my Zillow saved searches, qualifies each match, and drops a summary in Slack.",
  "An agent that reads my Skool comments and drafts on-brand replies for me to approve.",
];

const CATEGORIES: { key: ComposeCategory; label: string; tint: string }[] = [
  { key: "sales", label: "Sales", tint: "border-emerald-300/25 bg-emerald-400/[0.05]" },
  { key: "content", label: "Content", tint: "border-violet-300/25 bg-violet-400/[0.05]" },
  { key: "ops", label: "Ops", tint: "border-amber-300/25 bg-amber-400/[0.05]" },
  { key: "research", label: "Research", tint: "border-sky-300/25 bg-sky-400/[0.05]" },
  { key: "support", label: "Support", tint: "border-rose-300/25 bg-rose-400/[0.05]" },
  { key: "idea-mvp", label: "Idea → MVP", tint: "border-cyan-300/25 bg-cyan-400/[0.05]" },
];

const DEFAULT_TINT = "border-white/10 bg-white/[0.03]";

export function AgentBuilderHero({ composeData }: { composeData: ComposeData }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.2 });
  const reduced = useReducedMotion() ?? false;
  const pausedByOwner = useMotionPaused();
  const [category, setCategory] = useState<ComposeCategory | null>(null);
  const [spec, setSpec] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [preview, setPreview] = useState<ComposePreview | null>(null);
  const [entitled, setEntitled] = useState(false);

  // One post-mount check: is this visitor signed in? (PA-POS-34 — every owner composes.) Any
  // failure (signed out, network, endpoint missing) leaves the default signup route in place.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/app/agent-builder/entitlement", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ entitled?: boolean }>) : null))
      .catch(() => null)
      .then((body) => {
        if (!cancelled && body?.entitled === true) setEntitled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rotate the placeholder while the box is empty and on screen. Reduced motion and the
  // footer "Pause animations" toggle pin the current one; scrolling past the hero stops
  // the interval instead of ticking re-renders forever.
  useEffect(() => {
    if (reduced || pausedByOwner || !inView || spec !== "") return;
    const t = setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length),
      4000,
    );
    return () => clearInterval(t);
  }, [reduced, pausedByOwner, inView, spec]);

  // Preview after the owner types 15+ chars and pauses for a second. Pure client-side
  // match against the shipped catalogs — illustrative only.
  useEffect(() => {
    if (spec.trim().length < 15) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => setPreview(matchSpec(spec, category, composeData)), 1000);
    return () => clearTimeout(t);
  }, [spec, category, composeData]);

  function compose() {
    const trimmed = spec.trim();
    if (entitled) {
      // Signed in → the Library create surface (PA-POS-34), spec riding along.
      router.push(
        trimmed
          ? `/agents?spec=${encodeURIComponent(trimmed)}#compose`
          : "/agents#compose",
      );
      return;
    }
    // Anonymous: nothing is created. The idea is captured so signup can finish what the
    // visitor started — it prefills the Agent Builder on their first signed-in visit.
    if (trimmed) saveAgentIdea(trimmed);
    const query = trimmed
      ? `intent=agent-builder&spec=${encodeURIComponent(trimmed)}`
      : "intent=agent-builder";
    router.push(`/start?${query}`);
  }

  const tint = CATEGORIES.find((c) => c.key === category)?.tint ?? DEFAULT_TINT;

  return (
    <div ref={rootRef} data-agent-builder className="mx-auto mt-10 w-full max-w-2xl text-left">
      <p className="text-center text-sm text-slate-400">
        Describe the agent you need. Pocket Agent composes it inside your workspace.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {CATEGORIES.map((c) => {
          const selected = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(selected ? null : c.key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                selected
                  ? `${c.tint} text-slate-100`
                  : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
              style={{ fontFamily: MONO_FONT }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className={`mt-4 rounded-2xl border p-3 transition-colors ${tint}`}>
        <textarea
          data-agent-builder-input
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          rows={3}
          aria-label="Describe the agent you need"
          className="w-full resize-none rounded-xl bg-transparent px-2 py-1.5 text-sm leading-relaxed text-slate-100 placeholder-slate-500 outline-none"
          style={{ fontFamily: MONO_FONT }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400"
            style={{ fontFamily: MONO_FONT }}
          >
            🧩 Uses your Personas + Apps + Skills
          </span>
          <button
            data-agent-builder-compose
            type="button"
            onClick={compose}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02]"
          >
            Compose →
          </button>
        </div>
      </div>

      <LazyMotion features={domAnimation} strict>
        <AnimatePresence>
          {preview && (
            <m.div
              style={MOTION_LAYER}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="relative mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              {/* Poc in the corner — the character who'd run this composition (PA-POS-33). */}
              <span className="absolute -right-2.5 -top-2.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-cyan-300/25 bg-[#0a1f28]">
                <Image src={pocArtSrc("default")} width={32} height={32} alt="Poc" />
              </span>
              <p className="text-[13px] leading-relaxed text-slate-300">
                <span className="text-slate-500">Would compose:</span>{" "}
                <span className="text-slate-100">[Persona: {preview.persona}]</span>
                {preview.apps.length > 0 && (
                  <> + <span className="text-slate-100">[Apps: {preview.apps.join(", ")}]</span></>
                )}
                {preview.skills.length > 0 && (
                  <> + <span className="text-slate-100">[Skills: {preview.skills.join(", ")}]</span></>
                )}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Illustrative — your real agent is tuned to your Business Brain and staged for
                your approval before it runs.
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </div>
  );
}
