"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import {
  annualUsd,
  TIER_CARDS,
  tierCardFor,
  type FunnelTier,
} from "@/lib/launch-funnel/quiz";
import { MONO_FONT, type Testimonial } from "@/lib/launch-funnel/copy";
import { trackEvent } from "@/lib/analytics/events";
import Countdown from "./Countdown";

const TRUST_BADGES = ["Local brain", "Stripe secure", "Instant access"];

export default function Offer({
  matchedTier,
  personaPhrase,
  answers,
  operatorCount,
  starRating,
  testimonials,
}: {
  matchedTier: FunnelTier;
  personaPhrase: string;
  answers: string;
  operatorCount: string;
  starRating: string;
  testimonials: Testimonial[];
}) {
  const [selectedTier, setSelectedTier] = useState<FunnelTier>(matchedTier);
  const [annual, setAnnual] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedCard = tierCardFor(selectedTier);

  function selectTier(tier: FunnelTier) {
    setSelectedTier(tier);
    trackEvent("funnel_tier_selected", { tier, source: "offer_card" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    trackEvent("funnel_checkout_started", { tier: selectedTier });
    try {
      const res = await fetch("/api/pocket-agent/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          tier: selectedTier,
          funnel: true,
          answers,
        }),
      });
      if (res.status === 502 || res.status === 503) {
        setError("Checkout is temporarily paused — try again in a minute.");
        return;
      }
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
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      {/* Header + countdown */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Your Pocket Agent setup is ready.
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">
            We&apos;ve matched you with{" "}
            <span className="font-semibold text-cyan-200">
              {selectedCard.name}
            </span>{" "}
            — built for {personaPhrase}.
          </p>
        </div>
        <div className="shrink-0">
          <Countdown />
        </div>
      </div>

      {/* Hero mockup + annotation chips for their picks */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <Image
          src="/landing-hero.png"
          alt="The Pocket Agent dashboard matched to your answers."
          width={1600}
          height={1000}
          className="h-auto w-full"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          `Persona: ${personaPhrase.replace(/^an? /, "")}`,
          `Plan: ${selectedCard.name}`,
          "Mission Control on day one",
        ].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-cyan-300/25 bg-cyan-300/[0.05] px-3 py-1 text-xs text-cyan-100"
            style={{ fontFamily: MONO_FONT }}
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Billing toggle */}
      <div className="mt-10 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            annual
              ? "text-slate-400 hover:text-slate-200"
              : "bg-white/10 text-slate-100"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            annual
              ? "bg-white/10 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Annual · 2 months free
        </button>
      </div>

      {/* Tier cards + conversion panel */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 sm:grid-cols-3">
          {TIER_CARDS.map((card) => {
            const active = card.tier === selectedTier;
            return (
              <button
                type="button"
                key={card.tier}
                onClick={() => selectTier(card.tier)}
                className={`flex flex-col rounded-2xl border p-5 text-left transition ${
                  active
                    ? "border-cyan-300/60 bg-cyan-300/[0.06] shadow-[0_0_40px_-16px_rgba(34,211,238,0.8)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-100">
                    {card.name}
                  </span>
                  {card.badge ? (
                    <span
                      className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {card.badge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-sm text-slate-500 line-through">
                    ${annual ? annualUsd(card.anchorUsd) : card.anchorUsd}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-100">
                    ${annual ? annualUsd(card.monthlyUsd) : card.monthlyUsd}
                  </span>
                  <span className="text-sm text-slate-500">
                    {annual ? "/yr" : "/mo"}
                  </span>
                </div>
                {annual ? (
                  <div className="mt-1 text-xs text-cyan-200">
                    2 months free · ≈ ${card.monthlyUsd}/mo
                  </div>
                ) : null}

                <p className="mt-3 text-xs font-medium text-slate-400">
                  {card.blurb}
                </p>
                <ul className="mt-3 space-y-1.5 text-[13px] text-slate-300">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-0.5 text-cyan-300">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className={`mt-4 inline-flex items-center gap-2 text-xs font-semibold ${
                    active ? "text-cyan-200" : "text-slate-500"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full border ${
                      active
                        ? "border-cyan-300 bg-cyan-300"
                        : "border-slate-500"
                    }`}
                  />
                  {active ? "Selected" : "Choose this plan"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right-sidebar conversion panel */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-100">
                {selectedCard.name}
              </span>
              <span className="text-2xl font-extrabold text-slate-100">
                ${selectedCard.monthlyUsd}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              14-day free trial, then ${selectedCard.monthlyUsd}/mo. Cancel any
              time.
            </p>

            <label
              htmlFor="funnel-email"
              className="mt-5 mb-1.5 block text-sm font-medium text-slate-300"
            >
              Email
            </label>
            <input
              id="funnel-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.com"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-accent/30"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Used for activation and receipt.
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm text-amber-200">
              <span aria-hidden>★★★★★</span>
              <span className="text-slate-400">
                Rated {starRating}/5 by {operatorCount}+ operators
              </span>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {busy
                ? "Loading…"
                : `Get Pocket Agent ${selectedCard.name} — $${selectedCard.monthlyUsd}/mo`}
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Secure Stripe checkout · Cancel anytime · 30-day money-back
              guarantee
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {TRUST_BADGES.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400"
                  style={{ fontFamily: MONO_FONT }}
                >
                  {b}
                </span>
              ))}
            </div>
          </form>
          {annual ? (
            <p className="mt-3 px-2 text-center text-xs text-slate-500">
              Your trial starts on the monthly plan — ask us about annual billing
              once you&apos;re in.
            </p>
          ) : null}
        </aside>
      </div>

      {/* Testimonials */}
      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {testimonials.map((t) => (
          <figure
            key={t.attribution}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <blockquote className="text-sm leading-relaxed text-slate-300">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-xs text-slate-500">
              — {t.attribution}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
