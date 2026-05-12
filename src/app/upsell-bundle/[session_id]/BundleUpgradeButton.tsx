"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "redirecting";

export default function BundleUpgradeButton({
  sessionId,
  deltaUsd,
  remainingCount,
}: {
  sessionId: string;
  deltaUsd: number;
  remainingCount: number;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = status !== "idle";

  async function handleClick() {
    setError(null);
    setStatus("submitting");
    try {
      const res = await fetch("/api/apa/bundle-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error || "Could not start upgrade. Please try again.");
        setStatus("idle");
        return;
      }
      const data = (await res.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        setError("Upgrade link missing. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("redirecting");
      window.location.assign(data.checkout_url);
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || deltaUsd <= 0}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_50px_-12px_rgba(34,211,238,0.8)] transition hover:scale-[1.01] hover:shadow-[0_0_70px_-8px_rgba(34,211,238,0.95)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:text-lg"
      >
        {status === "submitting"
          ? "Starting upgrade…"
          : status === "redirecting"
            ? "Redirecting to Stripe…"
            : `Yes — add the other ${remainingCount} for $${deltaUsd.toFixed(0)} more →`}
      </button>
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
