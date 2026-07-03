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
  badge?: string;
  anchor?: string;
};

const VISIBLE_TIERS: VisibleTier[] = [
  {
    name: "Personal Brain",
    price: "$37",
    tier: "starter",
    pitch: "Your first Persona with the Apps and Skills to do real work.",
    rows: [
      "Single Business Brain + basic capture",
      "1 Persona (your first AI Agent)",
      "5 prebuilt Skills",
      "Mission Control + budgets",
      "AI Office Launch Kit + Launchpad access — free",
    ],
    ctaLabel: "Start Personal Brain",
  },
  {
    name: "Business Agent",
    price: "$97",
    tier: "pro",
    featured: true,
    badge: "Most Popular",
    pitch:
      "Clone-and-customize Personas + connected tools + the Apps you actually need.",
    rows: [
      "Everything in Personal Brain",
      "Clone-and-customize Personas (your AI Agents)",
      "Connected tools — Gmail, Calendar, Slack, QuickBooks",
      "Capture Inbox, Follow-Up Sweeps, Ingesters, Email Drafter",
      "5 prebuilt Skills — 20 at Pro+",
    ],
    ctaLabel: "Get My AI Team",
  },
  {
    name: "AI Agent Workspace",
    price: "$497",
    tier: "studio_plus",
    badge: "Full Cockpit",
    pitch:
      "Every Persona, every App, every Skill — 30 total. Idea Engine, Lead Scout vertical packs, Decision Roundtable, Voice Calls, the full stack.",
    rows: [
      "Everything in Business Agent",
      "Idea Engine — ship a working MVP from one idea",
      "Lead Scout vertical packs (7 verticals)",
      "Decision Roundtable",
      "All 30 prebuilt Skills + advanced Mission Control",
      "The full Layoutbook + Field Book premium template gallery, included",
    ],
    ctaLabel: "Get AI Agent Workspace",
    anchor:
      "PaidCreators sells you a $497 plan. You still spend the next twelve months executing it. Pocket Agent sells you the workers who execute it for you — one month at $497 delivers what PaidCreators' whole plan tells you to go build.",
  },
];

type QuizOption = {
  want: string;
  plan: string;
  price: string;
  ctaLabel: string;
  tier: string;
  href?: string;
};

const QUIZ_OPTIONS: QuizOption[] = [
  {
    want: "One place for my own ideas, notes, and business context.",
    plan: "Personal Brain",
    price: "$37/mo",
    ctaLabel: "Start Personal Brain",
    tier: "starter",
  },
  {
    want: "A team of AI agents working across my business.",
    plan: "Business Agent",
    price: "$97/mo",
    ctaLabel: "Get My AI Team",
    tier: "pro",
  },
  {
    want: "Ideas turned into live assets, with prospects lined up.",
    plan: "AI Agent Workspace",
    price: "$497/mo",
    ctaLabel: "Get AI Agent Workspace",
    tier: "studio_plus",
  },
  {
    want: "Custom usage, permissions, integrations, or team setup.",
    plan: "Enterprise",
    price: "Custom",
    ctaLabel: "Apply for Enterprise",
    tier: "enterprise",
    href: "/enterprise",
  },
];

const HIDDEN_TIERS: { name: string; price: string; pitch: string; tier: string; href?: string }[] =
  [
    {
      name: "Pro+",
      price: "$149/mo",
      pitch:
        "More connected tools and specialists, plus a first agent you can put on a private link. Field Book premium templates included — Layoutbook premium comes with the upgrade to the full workspace.",
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
            {t.badge ? (
              <div
                className="mb-3 inline-block w-fit rounded-full bg-cyan-300/15 px-3 py-1 text-[11px] font-medium text-cyan-300"
                style={{ fontFamily: MONO_FONT }}
              >
                {t.badge}
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
            {t.anchor ? (
              <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3 text-xs leading-relaxed text-slate-400">
                {t.anchor}
              </p>
            ) : null}
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
                <Link
                  href={t.href}
                  className="mt-4 text-sm font-semibold text-cyan-300 transition hover:underline"
                >
                  {t.tier === "enterprise" ? "Apply for Enterprise" : `Learn more`} →
                </Link>
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

      {/* PLAN SELECTOR QUIZ (Part 9M) — one question to remove decision drag. */}
      <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <h3 className="text-xl font-bold tracking-tight text-slate-100">
          Not sure which plan to choose?
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Answer one question: what do you want Pocket Agent to do first?
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {QUIZ_OPTIONS.map((o) => (
            <div
              key={o.plan}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <p className="flex-1 text-[15px] leading-relaxed text-slate-300">
                “{o.want}”
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">
                  <span className="text-slate-200">{o.plan}</span> · {o.price}
                </span>
                {o.href ? (
                  <Link
                    href={o.href}
                    className="shrink-0 text-sm font-semibold text-cyan-300 transition hover:underline"
                  >
                    {o.ctaLabel} →
                  </Link>
                ) : (
                  <Link
                    href={`/start?tier=${o.tier}`}
                    className="shrink-0 text-sm font-semibold text-cyan-300 transition hover:underline"
                  >
                    {o.ctaLabel} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
