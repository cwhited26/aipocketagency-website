"use client";

import { useState } from "react";
import Link from "next/link";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

type VisibleTier = {
  name: string;
  price: string;
  pitch: string;
  rows: string[];
  ctaLabel: string;
  tier: string;
  featured?: boolean;
};

const VISIBLE_TIERS: VisibleTier[] = [
  {
    name: "Personal Brain",
    price: "$37",
    tier: "starter",
    pitch: "The brain + one worker.",
    rows: [
      "Business Brain",
      "1 Persona",
      "Core Apps (Email Drafter, Ingesters)",
      "Mission Control + budgets",
      "AI Office Launch Kit — free",
    ],
    ctaLabel: "Start",
  },
  {
    name: "Business Agent",
    price: "$97",
    tier: "pro",
    featured: true,
    pitch: "The worker, across your tools.",
    rows: [
      "Everything in Personal Brain",
      "Multiple Personas",
      "Connected tools — Gmail, Calendar, Slack, QuickBooks",
      "Follow-Up Sweeps + Landing Page Builder",
      "AI Office Launch Kit — free",
    ],
    ctaLabel: "Start — most pick this",
  },
  {
    name: "AI Agent Workspace",
    price: "$497",
    tier: "studio_plus",
    pitch: "The whole operation.",
    rows: [
      "Everything in Business Agent",
      "Unlimited Personas",
      "Lead Scout vertical packs",
      "Decision Roundtable",
      "Full Mission Control cockpit",
    ],
    ctaLabel: "Start",
  },
];

const HIDDEN_TIERS: { name: string; price: string; pitch: string; tier: string; href?: string }[] =
  [
    {
      name: "Pro+",
      price: "$149/mo",
      pitch: "More connected tools and specialists, plus a first agent you can put on a private link.",
      tier: "pro_plus",
    },
    {
      name: "Studio",
      price: "$297/mo",
      pitch: "The step before the full workspace — more Apps, more Personas, more reach.",
      tier: "studio",
    },
    {
      name: "Enterprise",
      price: "Talk to us",
      pitch: "Your team on one workspace with the controls a bigger operation needs.",
      tier: "enterprise",
      href: "mailto:chase@tnvex.com?subject=Pocket%20Agent%20Enterprise%20inquiry",
    },
  ];

export default function PricingPlans() {
  const [showAll, setShowAll] = useState(false);

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {VISIBLE_TIERS.map((t) => (
          <div
            key={t.name}
            className={`flex flex-col rounded-2xl border p-7 ${
              t.featured
                ? "border-cyan-300/40 bg-cyan-300/[0.05]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {t.featured ? (
              <div
                className="mb-3 inline-block w-fit rounded-full bg-cyan-300/15 px-3 py-1 text-[11px] font-medium text-cyan-300"
                style={{ fontFamily: MONO_FONT }}
              >
                most pick this
              </div>
            ) : null}
            <h3 className="text-lg font-semibold text-slate-100">{t.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-100">
                {t.price}
              </span>
              <span className="text-sm text-slate-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{t.pitch}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-300">
              {t.rows.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-1 text-cyan-300">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/start?tier=${t.tier}`}
              className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:scale-[1.02] ${
                t.featured
                  ? "bg-accent text-accent-foreground"
                  : "border border-accent/50 bg-accent/[0.04] text-accent hover:bg-accent/[0.08]"
              }`}
            >
              {t.ctaLabel}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-sm font-semibold text-cyan-300 transition hover:underline"
        >
          {showAll ? "Hide the in-between plans" : "See all plans"}
        </button>
      </div>

      {showAll ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HIDDEN_TIERS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <h3 className="text-base font-semibold text-slate-100">
                {t.name}
              </h3>
              <div className="mt-1 text-lg font-bold text-slate-200">
                {t.price}
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-400">{t.pitch}</p>
              {t.href ? (
                <a
                  href={t.href}
                  className="mt-4 text-sm font-semibold text-cyan-300 transition hover:underline"
                >
                  Email us →
                </a>
              ) : (
                <Link
                  href={`/start?tier=${t.tier}`}
                  className="mt-4 text-sm font-semibold text-cyan-300 transition hover:underline"
                >
                  Start {t.name} →
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
