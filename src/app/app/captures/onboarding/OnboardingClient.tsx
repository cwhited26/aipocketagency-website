"use client";

// OnboardingClient — the 4-step Pocket Capture setup wizard (PC-MARK-3). Mobile-first (TikTok-funnel
// buyers are on iPhone): single-column, 390px-friendly, big tap targets, dark to match the app.
//
//   1. Welcome + API token  — mint once, show plaintext once, copy + "I've saved it" to advance
//   2. Install iOS Shortcut — instructions + deep-link button (placeholder until PC-CORE-4 publishes)
//   3. Email + SMS contacts — show + copy the per-user address (PC-CORE-2) and number (PC-CORE-3)
//   4. First capture        — poll the feed (PC-CORE-6 endpoint) until the first capture lands, then done
//
// Every step has a Skip so a buyer who doesn't want to test right now still reaches "complete" (the
// dashboard stops redirecting them back). Completion is marked idempotently on finish or skip.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedItem } from "@/lib/pocket-capture/feed";
import {
  IOS_SHORTCUT_NAME,
  iosShortcutInstallUrl,
  isShortcutPublished,
} from "@/lib/pocket-capture/ios-shortcut";

const TOTAL_STEPS = 4;
const POLL_INTERVAL_MS = 3000;

const DASHBOARD_PATH = "/app/captures";

// ─── Small building blocks ──────────────────────────────────────────────────────

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === step ? "w-6 bg-cyan-400" : n < step ? "w-1.5 bg-cyan-700" : "w-1.5 bg-slate-700"
          }`}
        />
      ))}
    </div>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const onCopy = useCallback(async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API blocked (insecure context / denied permission) — tell the user to copy manually
      // rather than swallowing it.
      setFailed(true);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-400/30 transition active:scale-95 hover:bg-cyan-500/20"
    >
      {failed ? "Copy manually" : copied ? "Copied ✓" : label}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-cyan-400 px-6 py-3.5 text-base font-semibold text-slate-950 transition active:scale-[0.99] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SkipButton({ onClick, label = "Skip for now" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2 text-center text-sm font-medium text-slate-500 transition hover:text-slate-300"
    >
      {label}
    </button>
  );
}

function StepShell({
  step,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  step: number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepDots step={step} />
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">{eyebrow}</p>
        <h1 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Step 1 — API token ─────────────────────────────────────────────────────────

function StepToken({ onNext }: { onNext: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const requested = useRef(false);

  const mint = useCallback(async () => {
    setError(null);
    try {
      // Mint via PC-CORE-4/PC-CORE-5's token endpoint (returns the plaintext once, status 201).
      const res = await fetch("/api/app/pocket-capture/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "iOS Shortcut" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Couldn't generate your key (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { token?: string };
      if (!body.token) {
        setError("The server didn't return a key. Try again.");
        return;
      }
      setToken(body.token);
    } catch {
      setError("Network error generating your key. Check your connection and try again.");
    }
  }, []);

  // Mint exactly once on mount — the plaintext is shown once and never re-fetchable.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void mint();
  }, [mint]);

  return (
    <StepShell
      step={1}
      eyebrow="Step 1 of 4"
      title="Your Pocket Capture is ready."
      subtitle="Let's get you set up in 60 seconds. First, here's your private key — the iOS Shortcut uses it to send captures to your feed."
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        {error ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void mint()}
              className="self-start rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              Try again
            </button>
          </div>
        ) : token === null ? (
          <p className="text-sm text-slate-400">Generating your key…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your API key</p>
              <p className="mt-1 break-all rounded-xl bg-slate-950/70 px-3 py-3 font-mono text-sm text-cyan-200">
                {token}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-amber-300/90">
                Save this now — we only show it once. You can always generate a new one later.
              </p>
              <CopyButton value={token} label="Copy key" />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-950/50 px-3 py-3">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="h-5 w-5 shrink-0 rounded border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400"
              />
              <span className="text-sm text-slate-300">I&apos;ve saved my key somewhere safe.</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onNext} disabled={token === null || !saved}>
          Continue
        </PrimaryButton>
      </div>
    </StepShell>
  );
}

// ─── Step 2 — iOS Shortcut ────────────────────────────────────────────────────────

function StepShortcut({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const url = iosShortcutInstallUrl();
  const published = isShortcutPublished(url);

  return (
    <StepShell
      step={2}
      eyebrow="Step 2 of 4"
      title={`Install the “${IOS_SHORTCUT_NAME}” Shortcut`}
      subtitle="One tap to add Siri voice capture. Say “Hey Siri, save this” and speak — eyes up, hands free."
    >
      <ol className="flex flex-col gap-3">
        {[
          "Tap Install Shortcut below — it opens in the Shortcuts app.",
          "Tap “Add Shortcut” to save it to your library.",
          "When prompted, paste the API key from Step 1.",
          "Say “Hey Siri, save this” anytime — or add it to your Action Button.",
        ].map((line, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-slate-300">{line}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3">
        {published ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-cyan-400 px-6 py-3.5 text-center text-base font-semibold text-slate-950 transition active:scale-[0.99] hover:bg-cyan-300"
          >
            Install Shortcut →
          </a>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center text-sm text-amber-200/90">
            The one-tap Shortcut is publishing soon. You can still use Share, Email, and SMS capture
            today — set those up on the next screen.
          </div>
        )}
        <PrimaryButton onClick={onNext}>Done — next</PrimaryButton>
        <SkipButton onClick={onSkip} label="I'm not on iPhone — skip" />
      </div>
    </StepShell>
  );
}

// ─── Step 3 — Email + SMS ─────────────────────────────────────────────────────────

function ContactRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string | null;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      {value ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 break-all font-mono text-sm text-slate-100">{value}</p>
          <CopyButton value={value} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{hint ?? "Not available yet."}</p>
      )}
    </div>
  );
}

function StepContacts({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [smsUnavailable, setSmsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    let active = true;
    void (async () => {
      const [emailRes, smsRes] = await Promise.allSettled([
        fetch("/api/app/pocket-capture/inbound-config").then((r) => r.json() as Promise<{ email?: string }>),
        fetch("/api/app/pocket-capture/sms-number").then(
          (r) => r.json() as Promise<{ phone_number?: string | null; reason?: string }>,
        ),
      ]);
      if (!active) return;
      if (emailRes.status === "fulfilled" && emailRes.value.email) setEmail(emailRes.value.email);
      if (smsRes.status === "fulfilled") {
        if (smsRes.value.phone_number) setPhone(smsRes.value.phone_number);
        else setSmsUnavailable(true);
      } else {
        setSmsUnavailable(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <StepShell
      step={3}
      eyebrow="Step 3 of 4"
      title="Save these to your contacts"
      subtitle="Forward email to your address, or text/MMS your number — both land straight in your feed. Save them now so they're one tap away."
    >
      {loading ? (
        <p className="text-center text-sm text-slate-400">Loading your address and number…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ContactRow
            icon="✉️"
            label="Your email-forward address"
            value={email}
            hint="We couldn't load your address — you can grab it later in the dashboard."
          />
          <ContactRow
            icon="📱"
            label="Your SMS capture number"
            value={phone}
            hint={smsUnavailable ? "SMS isn't available yet — it's provisioning." : undefined}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onNext}>I&apos;ve saved them — next</PrimaryButton>
        <SkipButton onClick={onSkip} />
      </div>
    </StepShell>
  );
}

// ─── Step 4 — First capture ───────────────────────────────────────────────────────

function StepFirstCapture({
  onComplete,
  completing,
  completeError,
}: {
  onComplete: () => void;
  completing: boolean;
  completeError: string | null;
}) {
  const [capture, setCapture] = useState<FeedItem | null>(null);

  // Poll the feed until the first capture lands, then stop. The interval is cleared the moment a
  // capture is found (shouldStopPolling) and on unmount.
  useEffect(() => {
    if (capture) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/app/pocket-capture/feed?limit=1");
        if (!res.ok) return;
        const body = (await res.json()) as { captures?: FeedItem[] };
        const first = body.captures?.[0];
        if (active && first) setCapture(first);
      } catch {
        // Transient poll failure — keep trying on the next tick rather than erroring the step.
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [capture]);

  if (capture) {
    return (
      <StepShell step={4} eyebrow="You're all set" title="You're done. Welcome to Pocket Capture.">
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Your first capture</p>
          <div className="mt-3 flex gap-3">
            <span aria-hidden className="text-xl">
              {capture.icon}
            </span>
            <div className="min-w-0">
              {capture.title && <p className="font-semibold text-slate-100">{capture.title}</p>}
              <p className="break-words text-sm text-slate-300">{capture.preview}</p>
            </div>
          </div>
        </div>
        {completeError && <p className="text-center text-sm text-rose-300">{completeError}</p>}
        <PrimaryButton onClick={onComplete} disabled={completing}>
          {completing ? "Finishing…" : "Go to my captures →"}
        </PrimaryButton>
      </StepShell>
    );
  }

  return (
    <StepShell
      step={4}
      eyebrow="Step 4 of 4"
      title="Send your first capture"
      subtitle="Forward an email, text your number, or share something to Pocket Capture right now. We'll show it here the moment it lands."
    >
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-8">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" aria-hidden />
        <p className="text-sm text-slate-400">Listening for your first capture…</p>
      </div>
      {completeError && <p className="text-center text-sm text-rose-300">{completeError}</p>}
      <div className="flex flex-col gap-2">
        <SkipButton onClick={onComplete} label={completing ? "Finishing…" : "Skip — I'll test later"} />
      </div>
    </StepShell>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────────

export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const next = useCallback(() => setStep((s) => Math.min(TOTAL_STEPS, s + 1)), []);

  // Mark onboarding complete (idempotent), then hand off to the dashboard. Called on finish or on a
  // step-4 skip. Navigates even if the mark fails (the buyer shouldn't be trapped) but surfaces the
  // error first so a retry is possible.
  const complete = useCallback(async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch("/api/app/pocket-capture/onboarding/complete", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setCompleteError(body.error ?? `Couldn't save your progress (${res.status}). Tap again to retry.`);
        setCompleting(false);
        return;
      }
    } catch {
      setCompleteError("Network error saving your progress. Tap again to retry.");
      setCompleting(false);
      return;
    }
    router.push(DASHBOARD_PATH);
  }, [router]);

  return (
    <div className="min-h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto flex max-w-md flex-col px-5 py-10 sm:py-14">
        {step === 1 && <StepToken onNext={next} />}
        {step === 2 && <StepShortcut onNext={next} onSkip={next} />}
        {step === 3 && <StepContacts onNext={next} onSkip={next} />}
        {step === 4 && (
          <StepFirstCapture onComplete={() => void complete()} completing={completing} completeError={completeError} />
        )}
      </div>
    </div>
  );
}
