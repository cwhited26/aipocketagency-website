"use client";

import { useState } from "react";
import Link from "next/link";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

type Kind = "setup_standard" | "setup_premium";

const TIERS: {
  kind: Kind;
  name: string;
  price: string;
  lead: string;
  rows: string[];
  featured?: boolean;
}[] = [
  // Premium first — the anchor (Brunson, by adjacency): $2,500 sets the ceiling so $997 reads as
  // the reasonable middle.
  {
    kind: "setup_premium",
    name: "Done-With-You Setup — Premium",
    price: "$2,500",
    lead: "Everything in Standard, plus the connected + first-run work that gets you to live output on the call:",
    rows: [
      "We connect your email + context so the agent reads from day one",
      "We run your first Lead Scout sweep with you",
      "We build your first daily and weekly brief",
      "We run your first Follow-Up Sweep",
      "A 60-minute implementation call + a 30-day check-in call",
    ],
  },
  {
    kind: "setup_standard",
    name: "Done-With-You Setup — Standard",
    price: "$997",
    featured: true,
    lead: "We build the workspace; you skip the setup week:",
    rows: [
      "We import your business knowledge into your Business Brain — your voice, customers, prices, processes",
      "We configure your 3 Personas to your actual jobs",
      "We set up your first workflow end to end",
      "A 30-minute implementation call to hand you the keys",
    ],
  },
];

export default function UpsellOffer({ sessionId }: { sessionId: string | null }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState("");

  async function buy(kind: Kind) {
    setBusy(kind);
    setError("");
    try {
      const res = await fetch("/api/pocket-agent/addon-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, session_id: sessionId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const data = (await res.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        setError("Something went wrong. Try again.");
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">
        {TIERS.map((t) => (
          <div
            key={t.kind}
            className={`flex flex-col rounded-2xl border p-7 ${
              t.featured
                ? "border-cyan-300/40 bg-cyan-300/[0.05]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <h3 className="text-lg font-semibold text-slate-100">{t.name}</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-100">
                {t.price}
              </span>
              <span className="text-sm text-slate-500">one-time</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{t.lead}</p>
            <ul className="mt-4 flex-1 space-y-2.5 text-sm text-slate-300">
              {t.rows.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-1 text-cyan-300">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => buy(t.kind)}
              disabled={busy !== null}
              className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 ${
                t.featured
                  ? "bg-accent text-accent-foreground"
                  : "border border-accent/50 bg-accent/[0.04] text-accent hover:bg-accent/[0.08]"
              }`}
            >
              {busy === t.kind
                ? "Loading…"
                : t.kind === "setup_premium"
                  ? `Go Premium (${t.price})`
                  : `Yes — set it up for me (${t.price})`}
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-sm leading-relaxed text-slate-400">
        If the setup call doesn’t leave you with a workspace that’s actually
        running your work, we keep working until it does. Reply, no form.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/thanks?bought=subscription_only"
          className="text-sm text-slate-400 transition hover:text-slate-200"
        >
          No thanks — I’ll use the Launch Kit
        </Link>
        <Link
          href="/setup"
          className="text-sm font-semibold text-cyan-300 transition hover:underline"
          style={{ fontFamily: MONO_FONT }}
        >
          Exactly what Done-With-You covers →
        </Link>
      </div>
    </div>
  );
}
