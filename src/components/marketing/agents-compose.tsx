"use client";

// The /agents Library compose input (PA-POS-34) — the primary create surface. Same textarea +
// category chips + Compose pattern as the homepage hero (PA-POS-28), but for a signed-in owner
// the button runs the REAL compose flow right here: POST /api/app/agent-builder/compose, and
// the approval card lands in Mission Control. Signed-out visitors carry the spec into signup
// at /start?intent=agent-builder — same address contract as before.
//
// Deep-link prefill: /agents?spec=<encoded>#compose (the homepage hero + the App-tile redirect
// route here). The legacy fragment form #compose?spec=<encoded> is parsed too, post-mount, so
// the page itself stays static.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MONO_FONT } from "./cta";
import {
  matchSpec,
  type ComposeCategory,
  type ComposeData,
  type ComposePreview,
} from "@/lib/marketing/compose-preview";
import {
  clearAgentIdea,
  readAgentIdea,
  saveAgentIdea,
} from "@/lib/marketing/agent-idea-store";

const CATEGORIES: { key: ComposeCategory; label: string; tint: string }[] = [
  { key: "sales", label: "Sales", tint: "border-emerald-300/25 bg-emerald-400/[0.05]" },
  { key: "content", label: "Content", tint: "border-violet-300/25 bg-violet-400/[0.05]" },
  { key: "ops", label: "Ops", tint: "border-amber-300/25 bg-amber-400/[0.05]" },
  { key: "research", label: "Research", tint: "border-sky-300/25 bg-sky-400/[0.05]" },
  { key: "support", label: "Support", tint: "border-rose-300/25 bg-rose-400/[0.05]" },
  { key: "idea-mvp", label: "Idea → MVP", tint: "border-cyan-300/25 bg-cyan-400/[0.05]" },
];

const DEFAULT_TINT = "border-white/10 bg-white/[0.03]";

type ComposeResponse = {
  personaName?: string;
  gatedAppsNote?: string;
  error?: string;
  suggestion?: string;
};

/** Reads a spec prefill from ?spec= or the legacy #compose?spec= fragment form. */
function specFromLocation(): string {
  if (typeof window === "undefined") return "";
  const query = new URLSearchParams(window.location.search).get("spec");
  if (query) return query.slice(0, 4_000);
  const hash = window.location.hash;
  const marker = hash.indexOf("?");
  if (hash.startsWith("#compose") && marker >= 0) {
    const fragmentSpec = new URLSearchParams(hash.slice(marker + 1)).get("spec");
    if (fragmentSpec) return fragmentSpec.slice(0, 4_000);
  }
  return "";
}

export function AgentsCompose({
  composeData,
  initialSignedIn = false,
}: {
  composeData: ComposeData;
  /** The authenticated mirror at /app/agents (PA-POS-37) sits behind the app auth gate, so it
   *  passes true and skips the entitlement round-trip — Compose runs the real flow from the
   *  first render. The marketing page keeps the post-mount check. */
  initialSignedIn?: boolean;
}) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [category, setCategory] = useState<ComposeCategory | null>(null);
  const [spec, setSpec] = useState("");
  const [preview, setPreview] = useState<ComposePreview | null>(null);
  const [composing, setComposing] = useState(false);
  const [staged, setStaged] = useState<{ personaName: string; gatedAppsNote: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // One post-mount check: signed in ⇒ the Compose button runs the real flow here (PA-POS-34 —
  // every tier composes). Any failure leaves the signup route in place.
  useEffect(() => {
    if (initialSignedIn) return;
    let cancelled = false;
    fetch("/api/app/agent-builder/entitlement", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ entitled?: boolean }>) : null))
      .catch(() => null)
      .then((body) => {
        if (!cancelled && body?.entitled === true) setSignedIn(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialSignedIn]);

  // Deep-link prefill from the hero / the App-tile redirect, once on mount. With no URL spec,
  // fall back to the idea captured before signup (the intent carry) — that's how a pay-first
  // buyer's typed prompt is waiting in the box on their first signed-in visit.
  useEffect(() => {
    const prefill = specFromLocation() || readAgentIdea();
    if (prefill) {
      setSpec(prefill);
      document.getElementById("compose")?.scrollIntoView({ block: "center" });
    }
  }, []);

  // Preview after 15+ chars and a one-second pause — the same illustrative client-side match
  // as the homepage hero.
  useEffect(() => {
    if (spec.trim().length < 15) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => setPreview(matchSpec(spec, category, composeData)), 1000);
    return () => clearTimeout(t);
  }, [spec, category, composeData]);

  async function compose() {
    const trimmed = spec.trim();
    if (!signedIn) {
      // Anonymous: nothing is created — capture the idea so signup finishes what they started.
      if (trimmed) saveAgentIdea(trimmed);
      const query = trimmed
        ? `intent=agent-builder&spec=${encodeURIComponent(trimmed)}`
        : "intent=agent-builder";
      router.push(`/start?${query}`);
      return;
    }
    if (trimmed.length < 12 || composing) return;
    setComposing(true);
    setErr(null);
    try {
      const res = await fetch("/api/app/agent-builder/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as ComposeResponse;
      if (!res.ok) {
        setErr(
          [body.error, body.suggestion].filter(Boolean).join(" ") ||
            "Composing failed. Try again.",
        );
        return;
      }
      setStaged({
        personaName: body.personaName ?? "Your agent",
        gatedAppsNote: body.gatedAppsNote ?? "",
      });
      setSpec("");
      setPreview(null);
      // The carried idea reached Mission Control — its job is done.
      clearAgentIdea();
    } catch {
      setErr("Composing failed. Check your connection and try again.");
    } finally {
      setComposing(false);
    }
  }

  const tint = CATEGORIES.find((c) => c.key === category)?.tint ?? DEFAULT_TINT;

  if (staged) {
    return (
      <div className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-6 sm:p-8">
        <p className="text-lg font-semibold text-slate-100">
          Composed. {staged.personaName} is staged in Mission Control.
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
          Read the whole agent on one card — the Persona, the Apps it runs, the Skills it
          starts with, the brain zones it may read. Nothing runs until you approve it.
        </p>
        {staged.gatedAppsNote && (
          <p className="mt-2 text-sm leading-relaxed text-amber-200/80">{staged.gatedAppsNote}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/app/mission-control"
            className="rounded-lg border border-accent/40 bg-accent/[0.06] px-4 py-2.5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/[0.12]"
          >
            Review it in Mission Control
          </Link>
          <button
            type="button"
            onClick={() => setStaged(null)}
            className="text-sm text-slate-400 transition hover:text-slate-200"
          >
            Compose another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
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
          data-agents-compose-input
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder="An agent that watches Gmail for adjuster emails and drafts SRA responses in my voice."
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
            data-agents-compose-button
            type="button"
            onClick={compose}
            disabled={composing}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition hover:scale-[1.02] disabled:opacity-60"
          >
            {composing ? "Composing…" : "Compose →"}
          </button>
        </div>
      </div>

      {err && <p className="mt-3 text-sm leading-relaxed text-red-400">{err}</p>}

      {preview && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
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
            Illustrative — your real agent is tuned to your Business Brain and staged for your
            approval before it runs.
          </p>
        </div>
      )}
    </div>
  );
}
