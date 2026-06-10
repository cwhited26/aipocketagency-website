"use client";

// Client child of /cancel/[reason]: logs the cancellation intent once on view, and runs the actual
// "Cancel Anyway" → POST /api/cancel/confirm → /cancel/confirm flow.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CancelReasonClient({
  reason,
  secondaryLabel,
}: {
  reason: string;
  secondaryLabel: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loggedRef = useRef(false);

  // Capture the reason once when the save option is viewed (saved=false until a cancel is confirmed).
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    void fetch("/api/cancel/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => {
      // Non-fatal: a failed intent log must never block the save flow.
    });
  }, [reason]);

  async function confirmCancel() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cancel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "We couldn't cancel just now. Please try again or reply to your email.");
        setSubmitting(false);
        return;
      }
      router.push("/cancel/confirm");
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={confirmCancel}
        disabled={submitting}
        className="text-sm text-neutral-500 underline underline-offset-4 transition hover:text-neutral-300 disabled:opacity-50"
      >
        {submitting ? "Canceling…" : secondaryLabel}
      </button>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
