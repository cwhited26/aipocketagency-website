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

type Status = "idle" | "submitting" | "redirecting";

export type BumpOffer = {
  /** Display name of the bumped kit ("CLAUDE.md Template Library"). */
  name: string;
  /** One-line pitch tying the bump to the primary kit. */
  pitch: string;
};

export default function CheckoutForm({
  source,
  bump,
}: {
  source: string;
  bump: BumpOffer | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bumpChecked, setBumpChecked] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status !== "idle";
  const total = bump && bumpChecked ? 25 : 15;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

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
          phone: trimmedPhone || undefined,
          source,
          bump: bump ? bumpChecked : false,
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

      const data = (await res.json()) as { checkout_url?: string };
      if (!data.checkout_url) {
        setError("Checkout link missing. Please try again.");
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
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_-20px_rgba(34,211,238,0.5)] sm:p-7"
      noValidate
    >
      <div className="space-y-5">
        <Field
          id="name"
          label="Name"
          value={name}
          onChange={setName}
          autoComplete="name"
          required
          disabled={busy}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          disabled={busy}
        />
        <Field
          id="phone"
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          disabled={busy}
        />
      </div>

      {bump ? (
        <label
          htmlFor="bump"
          className={`mt-6 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
            bumpChecked
              ? "border-accent/60 bg-accent/[0.06]"
              : "border-white/15 bg-white/[0.02] hover:border-accent/40"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            id="bump"
            type="checkbox"
            checked={bumpChecked}
            onChange={(e) => setBumpChecked(e.target.checked)}
            disabled={busy}
            className="mt-1 h-4 w-4 cursor-pointer rounded border-white/30 bg-black/40 accent-cyan-400"
          />
          <div className="flex-1 text-sm leading-relaxed text-slate-200">
            <div className="font-semibold text-slate-100">
              Yes — add{" "}
              <span className="text-accent">{bump.name}</span> for just{" "}
              <span className="text-slate-400 line-through">$15</span>{" "}
              <span className="font-bold text-accent">+$10 more</span>
            </div>
            <div className="mt-1 text-slate-300">{bump.pitch}</div>
            <div className="mt-2 text-xs text-slate-400">
              Save $5 when you add it now — this price isn&apos;t shown anywhere
              else on the site.
            </div>
          </div>
        </label>
      ) : null}

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
        {status === "submitting"
          ? "Starting checkout…"
          : status === "redirecting"
            ? "Redirecting to Stripe…"
            : `Continue to payment · $${total} →`}
      </button>
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
