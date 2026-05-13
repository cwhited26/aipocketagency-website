"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type Status = "idle" | "submitting" | "submitted";

/**
 * Waitlist email-capture form for the Capture Pack + Output Pack
 * landing pages. POSTs to `/api/apa/leads` with `waitlist_for` set to
 * the bundle slug. No Stripe redirect — waitlist leads aren't buyers
 * yet. Shows an inline success line on completion.
 */
export default function WaitlistForm({
  waitlistFor,
  cta,
  successLine,
}: {
  waitlistFor: "capture_pack" | "output_pack";
  cta: string;
  successLine: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status === "submitting";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email.");
      return;
    }

    setStatus("submitting");
    const leadId = generateUuidV4();

    try {
      const res = await fetch("/api/apa/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          name: trimmedName,
          email: trimmedEmail,
          source: waitlistFor,
          waitlist_for: waitlistFor,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }

      setStatus("submitted");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "submitted") {
    return (
      <div
        className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-6 text-center shadow-[0_0_40px_-20px_rgba(34,211,238,0.5)] sm:p-7"
        role="status"
      >
        <p className="text-lg font-semibold text-accent">You&apos;re in.</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          {successLine}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_-20px_rgba(34,211,238,0.5)] sm:p-7"
      noValidate
    >
      <div className="space-y-5">
        <Field
          id="waitlist-name"
          label="Name"
          value={name}
          onChange={setName}
          autoComplete="name"
          required
          disabled={busy}
        />
        <Field
          id="waitlist-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          disabled={busy}
        />
      </div>

      {error ? (
        <div
          className="mt-5 rounded-xl border border-red-400/30 bg-red-400/[0.08] p-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-accent-foreground shadow-[0_0_40px_-10px_rgba(34,211,238,0.7)] transition hover:scale-[1.01] hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.85)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {busy ? "Saving your spot…" : cta}
      </button>

      <p className="mt-4 text-center text-xs text-slate-500">
        No spam. No drip sequence. Just a heads-up when each module ships.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
      />
    </div>
  );
}
