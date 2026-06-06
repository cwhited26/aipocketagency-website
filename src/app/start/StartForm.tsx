"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const MONO_FONT =
  "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

// Display props are resolved server-side from the validated ?tier= param (see
// start/page.tsx) and passed as primitives so this client component never imports the
// server-side tier-caps module. `tier` is the only value sent to the checkout API.
export default function StartForm({
  defaultEmail = "",
  tier = "starter",
  tierLabel = "Starter",
  priceUsd = 37,
}: {
  defaultEmail?: string;
  tier?: string;
  tierLabel?: string;
  priceUsd?: number;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isStarter = tier === "starter";
  const priceLine = `$${priceUsd}/mo after the trial. Cancel anytime.`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pocket-agent/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, tier }),
      });
      if (res.status === 502 || res.status === 503) {
        setError(
          "Trial signups are temporarily paused — try again in a minute."
        );
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
    <main className="min-h-screen text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-md px-6 pb-20 pt-20 sm:pt-28">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 whitespace-nowrap text-xs text-cyan-300/70 sm:text-sm"
              style={{ fontFamily: MONO_FONT }}
            >
              [ pocket agent{isStarter ? "" : ` ${tierLabel.toLowerCase()}`} · $
              {priceUsd}/mo · 14-day free trial ]
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-accent via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                Start your 14-day free trial
              </span>
            </h1>
            <p className="mt-4 text-lg text-slate-300">{priceLine}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                First name{" "}
                <span className="text-slate-500">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chase"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-accent/30"
              />
            </div>
            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:text-lg"
            >
              {busy ? "Loading…" : "Start free trial"}
              {!busy ? (
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-5 w-5"
                  fill="currentColor"
                >
                  <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 01-1.414-1.414L11.586 11H3a1 1 0 110-2h8.586L7.05 5.464a1 1 0 010-1.414z" />
                </svg>
              ) : null}
            </button>
            <p className="text-center text-xs text-slate-500">
              After payment confirms, you&apos;ll be sent to your Pocket Agent.
            </p>
          </form>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div
              className="mb-4 text-xs uppercase tracking-wider text-slate-500"
              style={{ fontFamily: MONO_FONT }}
            >
              what happens next
            </div>
            <ol className="space-y-3">
              {[
                "Start your 14-day trial.",
                "Open your Pocket Agent.",
                "Add your first context — voice note, screenshot, or email.",
                "Get your first draft or call brief.",
                "Charged on day 15 unless you cancel.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              Your Pocket Agent will not send emails or customer replies without
              you. Every output is a draft you approve.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-black/40">
        <div className="mx-auto max-w-3xl px-6 py-12 text-center">
          <p className="text-sm leading-relaxed text-slate-400">
            <Link href="/" className="text-accent transition hover:underline">
              Back to the homepage
            </Link>
            .
          </p>
        </div>
        <div className="border-t border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-slate-600">
            © {new Date().getFullYear()} Whited Consulting. All rights
            reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
