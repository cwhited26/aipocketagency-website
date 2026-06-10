"use client";

import { useState } from "react";

export function UnsubscribeClient({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");

  async function unsubscribe() {
    setState("submitting");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="mt-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200">
        Done — {email} is unsubscribed from onboarding and marketing emails.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={unsubscribe}
        disabled={state === "submitting"}
        className="rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-50"
      >
        {state === "submitting" ? "Unsubscribing…" : "Unsubscribe from marketing emails"}
      </button>
      {state === "error" ? (
        <p className="mt-3 text-sm text-red-400">
          Something went wrong. Please try again, or reply to any email to opt out.
        </p>
      ) : null}
    </div>
  );
}
