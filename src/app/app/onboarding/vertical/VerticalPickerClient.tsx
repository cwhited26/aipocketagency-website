"use client";

// VerticalPickerClient — the "pick what describes you best" step (PA-POS-22). Seven tiles: six
// verticals + the explicit skip. Radio-group semantics with roving arrow-key focus; every tile
// carries the vertical's illustrated avatar (PA-POS-23), one line of that owner's day, and the
// three Personas a pick seeds. Ownership frame per PA-POS-19: the seed lands in the OWNER's own
// brain repo, not our database — said on the page, not in a tooltip.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PersonaAvatar } from "@/components/personas/avatar";

export type VerticalTile = {
  slug: string;
  label: string;
  who: string;
  day: string;
  avatarSlug: string;
  personaNames: string[];
};

const SKIP_VALUE = "skip";

export default function VerticalPickerClient({ tiles }: { tiles: VerticalTile[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const options = [...tiles.map((t) => t.slug), SKIP_VALUE];

  function onArrow(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % options.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      next = (index - 1 + options.length) % options.length;
    }
    if (next === null) return;
    e.preventDefault();
    setSelected(options[next]);
    tileRefs.current[next]?.focus();
  }

  async function submit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/app/onboarding/vertical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: selected === SKIP_VALUE ? null : selected }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not save your pick. Try again.");
        setSubmitting(false);
        return;
      }
      router.push("/app/onboarding");
    } catch {
      setError("Could not save your pick. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  const tileBase =
    "w-full text-left rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070a]";
  const tileOff = "border-slate-800 bg-slate-900/40 hover:border-slate-700";
  const tileOn = "border-[#22d3ee] bg-[#22d3ee]/5";

  return (
    <main className="min-h-screen bg-[#05070a] px-4 py-10">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(34,211,238,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-1.5 text-slate-700">
          <div className="w-1 h-1 rounded-full bg-[#22d3ee]/30" />
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-700">
            Pocket Agent · Workspace Setup
          </span>
          <div className="w-1 h-1 rounded-full bg-[#22d3ee]/30" />
        </div>

        <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase mb-2">
          Step 1 · Your business
        </div>
        <h1 className="text-2xl font-semibold text-slate-100">Pick what describes you best.</h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Your pick decides which Personas land in your workspace ready to work — three roles
          built for that business, plus the Apps and Skills they use. Everything seeded ships to
          your own Business Brain repo (a GitHub repository you own), not our database. Cancel
          any time and the brain is still yours.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div
          role="radiogroup"
          aria-label="Pick what describes you best"
          className="mt-6 grid gap-3 sm:grid-cols-2"
        >
          {tiles.map((t, i) => {
            const on = selected === t.slug;
            return (
              <button
                key={t.slug}
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (!selected && i === 0) ? 0 : -1}
                onClick={() => setSelected(t.slug)}
                onKeyDown={(e) => onArrow(e, i)}
                className={`${tileBase} ${on ? tileOn : tileOff}`}
              >
                <div className="flex items-start gap-3">
                  <PersonaAvatar slug={t.avatarSlug} size="md" alt={`${t.label} avatar`} />
                  <div className="min-w-0">
                    <h2 className="text-slate-100 font-medium">{t.label}</h2>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">
                      {t.who}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mt-3 leading-relaxed">{t.day}</p>
                <p className="text-xs text-slate-500 mt-3">
                  <span className="font-mono text-[#22d3ee]/80">
                    Seeds {t.personaNames.length} Personas:
                  </span>{" "}
                  {t.personaNames.join(" · ")}
                </p>
              </button>
            );
          })}

          <button
            ref={(el) => {
              tileRefs.current[tiles.length] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected === SKIP_VALUE}
            tabIndex={selected === SKIP_VALUE ? 0 : -1}
            onClick={() => setSelected(SKIP_VALUE)}
            onKeyDown={(e) => onArrow(e, tiles.length)}
            className={`${tileBase} sm:col-span-2 ${selected === SKIP_VALUE ? tileOn : tileOff}`}
          >
            <h2 className="text-slate-100 font-medium">Other / skip</h2>
            <p className="text-sm text-slate-400 mt-1">
              Skip everything, take me to Pocket Agent. No pre-seeded Personas — start from an
              empty workspace and build your own.
            </p>
          </button>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={submit}
            disabled={!selected || submitting}
            className="w-full rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-600">
            You can add, rename, or delete any seeded Persona later — they&apos;re yours to change.
          </p>
        </div>
      </div>
    </main>
  );
}
