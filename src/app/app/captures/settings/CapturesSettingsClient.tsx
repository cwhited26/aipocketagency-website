"use client";

// CapturesSettingsClient — the Pocket Capture control panel (PC-CORE-6). Mobile-first, dark to match
// the app. Surfaces (email-forward address, SMS number, iOS Shortcut) plus API token management,
// all over the endpoints PC-CORE-2/3/4 already ship. The plaintext of a freshly-minted token is shown
// exactly once (the mint endpoint never returns it again).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { iosShortcutInstallUrl, isShortcutPublished, IOS_SHORTCUT_NAME } from "@/lib/pocket-capture/ios-shortcut";
import RoutingRulesSection from "./RoutingRulesSection";

type TokenRow = {
  id: string;
  token_prefix: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const onCopy = useCallback(async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed(true);
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="shrink-0 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/30 transition hover:bg-cyan-500/20 active:scale-95"
    >
      {failed ? "Copy manually" : copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-base">
          {icon}
        </span>
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ValueRow({ value, mono = true }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/60 px-3 py-2.5">
      <span className={`min-w-0 break-all text-sm text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

// ─── SMS + Email surfaces ─────────────────────────────────────────────────────────

function SmsSection() {
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/app/pocket-capture/sms-number")
      .then((r) => r.json() as Promise<{ phone_number?: string | null }>)
      .then((d) => {
        if (!active) return;
        if (d.phone_number) {
          setPhone(d.phone_number);
          setState("ready");
        } else {
          setState("unavailable");
        }
      })
      .catch(() => active && setState("unavailable"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section icon="📱" title="Text capture">
      <p className="mb-2.5 text-xs leading-relaxed text-slate-500">
        Text or MMS this number — it lands straight in your feed. Save it to your contacts.
      </p>
      {state === "loading" && <p className="text-sm text-slate-500">Connecting…</p>}
      {state === "ready" && phone && <ValueRow value={phone} />}
      {state === "unavailable" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-200/90">
          Your number is still provisioning — check back in a minute.
        </p>
      )}
    </Section>
  );
}

function EmailSection() {
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/app/pocket-capture/inbound-config")
      .then((r) => r.json() as Promise<{ email?: string }>)
      .then((d) => {
        if (!active) return;
        if (d.email) {
          setEmail(d.email);
          setState("ready");
        } else {
          setState("error");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section icon="✉️" title="Email capture">
      <p className="mb-2.5 text-xs leading-relaxed text-slate-500">
        Forward any email to this address and it lands in your feed.
      </p>
      {state === "loading" && <p className="text-sm text-slate-500">Loading…</p>}
      {state === "ready" && email && <ValueRow value={email} />}
      {state === "error" && (
        <p className="text-sm text-slate-500">Couldn&apos;t load your address — reload to try again.</p>
      )}
    </Section>
  );
}

function ShortcutSection() {
  const url = iosShortcutInstallUrl();
  const published = isShortcutPublished(url);
  return (
    <Section icon="🎤" title="iOS Shortcut & Siri">
      <p className="mb-2.5 text-xs leading-relaxed text-slate-500">
        Install the “{IOS_SHORTCUT_NAME}” Shortcut for one-tap and “Hey Siri” voice capture.
      </p>
      {published ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.99]"
        >
          Install iOS Shortcut →
        </a>
      ) : (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-200/90">
          The one-tap Shortcut is publishing soon.
        </p>
      )}
    </Section>
  );
}

// ─── API tokens ───────────────────────────────────────────────────────────────────

function relDate(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TokensSection() {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/app/pocket-capture/api-tokens");
      if (!res.ok) {
        setLoadError(`Couldn't load your tokens (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { tokens?: TokenRow[] };
      setTokens(body.tokens ?? []);
    } catch {
      setLoadError("Network error loading tokens.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mint = useCallback(async () => {
    setMinting(true);
    setMintError(null);
    setMinted(null);
    try {
      const res = await fetch("/api/app/pocket-capture/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "API key" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMintError(body.error ?? `Couldn't create a key (${res.status}).`);
        setMinting(false);
        return;
      }
      const body = (await res.json()) as { token?: string };
      if (body.token) setMinted(body.token);
      await load();
    } catch {
      setMintError("Network error creating a key.");
    } finally {
      setMinting(false);
    }
  }, [load]);

  const revoke = useCallback(
    async (id: string) => {
      setRevokingId(id);
      try {
        const res = await fetch(`/api/app/pocket-capture/api-tokens/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setTokens((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
        }
      } catch {
        // Leave the row; the user can retry. A transient failure shouldn't wipe the list.
      } finally {
        setRevokingId(null);
      }
    },
    [],
  );

  return (
    <Section icon="🔑" title="API keys">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Keys authenticate the iOS Shortcut. We show a key&apos;s full value only once, when you create
        it.
      </p>

      {minted && (
        <div className="mb-3 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
            Your new key — save it now
          </p>
          <p className="mt-1.5 break-all rounded-lg bg-slate-950/70 px-3 py-2 font-mono text-sm text-cyan-200">
            {minted}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-amber-300/90">We won&apos;t show this again.</p>
            <CopyButton value={minted} />
          </div>
        </div>
      )}

      {loadError && <p className="mb-2 text-sm text-rose-300">{loadError}</p>}

      {tokens === null && !loadError ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tokens && tokens.length === 0 ? (
        <p className="text-sm text-slate-500">No keys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(tokens ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  {t.name ?? "API key"}{" "}
                  <span className="font-mono text-xs text-slate-500">{t.token_prefix}…</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  Created {relDate(t.created_at)} · Last used {relDate(t.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void revoke(t.id)}
                disabled={revokingId === t.id}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
              >
                {revokingId === t.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {mintError && <p className="mt-2 text-sm text-rose-300">{mintError}</p>}
      <button
        type="button"
        onClick={() => void mint()}
        disabled={minting}
        className="mt-3 w-full rounded-full border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/50 disabled:opacity-50"
      >
        {minting ? "Creating…" : "Create a new key"}
      </button>
    </Section>
  );
}

export default function CapturesSettingsClient() {
  return (
    <div className="min-h-full bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3">
          <Link href="/app/captures" className="text-slate-500 hover:text-slate-200" aria-label="Back to captures">
            ←
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">Capture settings</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Every way to get things into your feed — and the keys that power them.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <SmsSection />
          <EmailSection />
          <ShortcutSection />
          <TokensSection />
          <RoutingRulesSection />
        </div>
      </div>
    </div>
  );
}
