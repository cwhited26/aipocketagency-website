"use client";

import { useEffect, useRef, useState } from "react";
import { MONO_FONT } from "@/components/marketing/cta";
import { trackEvent } from "@/lib/analytics/events";

// The design-partner waitlist form (SPEC v1 §9). Posts to /api/waitlist/ghl-agency and flips to
// the thank-you state on success. Also fires the page-view event on mount — this component is the
// one client island on the page, so the view beacon lives here instead of a separate wrapper.

type FormState = "idle" | "submitting" | "done";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[15px] text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-2 block text-xs uppercase tracking-wider text-slate-400"
        style={{ fontFamily: MONO_FONT }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function GhlWaitlistForm() {
  const viewFired = useRef(false);
  useEffect(() => {
    if (viewFired.current) return;
    viewFired.current = true;
    trackEvent("ghl_agency_page_viewed", { path: "/for/ghl-agency" });
  }, []);

  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [clientCount, setClientCount] = useState("");
  const [topFrustration, setTopFrustration] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/waitlist/ghl-agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          agencyName,
          clientCount,
          topFrustration,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something broke on our end. Try again in a minute.");
        setState("idle");
        return;
      }
      trackEvent("ghl_waitlist_submitted", { clientCount });
      setState("done");
    } catch {
      setError("Something broke on our end. Try again in a minute.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.04] p-8 text-center">
        <p className="text-lg font-semibold text-slate-100">You&rsquo;re on the list.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
          Chase&rsquo;ll reach out this week if you&rsquo;re a design-partner fit.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-label="GHL agency waitlist">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={INPUT_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            autoComplete="name"
          />
        </Field>
        <Field label="Email">
          <input
            className={INPUT_CLASS}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            autoComplete="email"
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Agency name">
          <input
            className={INPUT_CLASS}
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            required
            maxLength={160}
            autoComplete="organization"
          />
        </Field>
        <Field label="Client sub-accounts you manage today">
          <input
            className={INPUT_CLASS}
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            value={clientCount}
            onChange={(e) => setClientCount(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Your #1 GHL frustration">
        <textarea
          className={`${INPUT_CLASS} min-h-28 resize-y`}
          value={topFrustration}
          onChange={(e) => setTopFrustration(e.target.value)}
          required
          maxLength={2000}
        />
      </Field>
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.02] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-lg"
      >
        {state === "submitting" ? "Reserving…" : "Reserve your seat →"}
      </button>
    </form>
  );
}
