"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "redirecting";

/**
 * Final step of the inline funnel — the buyer picks bundle or single, the
 * client POSTs the assembled selection to /api/apa/funnel/checkout, and
 * the API mints the right Stripe Checkout Session and returns the URL.
 */
export default function FunnelCheckoutButtons({
  leadId,
  pair,
  bundleDeltaUsd,
  pairAddOnUsd,
  primaryUsd,
  primaryShortName,
  bumpShortName,
}: {
  leadId: string;
  pair: boolean;
  bundleDeltaUsd: number;
  pairAddOnUsd: number;
  primaryUsd: number;
  primaryShortName: string;
  bumpShortName: string | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [intent, setIntent] = useState<"bundle" | "single" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = status !== "idle";
  const singleTotal = primaryUsd + pairAddOnUsd;

  async function start(bundle: boolean) {
    setError(null);
    setIntent(bundle ? "bundle" : "single");
    setStatus("submitting");
    try {
      const res = await fetch("/api/apa/funnel/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          pair,
          bundle,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error || "Could not start checkout. Please try again.");
        setStatus("idle");
        setIntent(null);
        return;
      }
      const data = (await res.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        setError("Checkout link missing. Please try again.");
        setStatus("idle");
        setIntent(null);
        return;
      }
      setStatus("redirecting");
      window.location.assign(data.checkout_url);
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
      setIntent(null);
    }
  }

  const bundleLabel =
    intent === "bundle" && status === "submitting"
      ? "Starting bundle…"
      : intent === "bundle" && status === "redirecting"
        ? "Redirecting to Stripe…"
        : `Yes — get all 5 for $47 →`;

  const singleLabelBase = bumpShortName
    ? `No thanks — just ${primaryShortName} + ${bumpShortName} for $${singleTotal}`
    : `No thanks — just ${primaryShortName} for $${singleTotal}`;
  const singleLabel =
    intent === "single" && status === "submitting"
      ? "Starting checkout…"
      : intent === "single" && status === "redirecting"
        ? "Redirecting to Stripe…"
        : `${singleLabelBase} →`;

  return (
    <div>
      <button
        type="button"
        onClick={() => start(true)}
        disabled={busy || bundleDeltaUsd <= 0}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_50px_-12px_rgba(34,211,238,0.8)] transition hover:scale-[1.01] hover:shadow-[0_0_70px_-8px_rgba(34,211,238,0.95)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:text-lg"
      >
        {bundleLabel}
      </button>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => start(false)}
          disabled={busy}
          className="text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {singleLabel}
        </button>
      </div>
      {error ? (
        <div
          className="mt-4 rounded-xl border border-red-400/30 bg-red-400/[0.08] p-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
