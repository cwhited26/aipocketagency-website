"use client";

import { useState, useEffect, useCallback } from "react";
import type { DigestPayload } from "@/lib/pa-drafts";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DigestResponse = { digest: DigestPayload; cached: boolean };

// ─── Icons ─────────────────────────────────────────────────────────────────────

function SparkleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path
        d="M7 1l1.2 4L12 6.2l-3.8 1.2L7 12l-1.2-4.6L2 6.2l3.8-1.2L7 1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}
    >
      <path
        d="M10 6a4 4 0 11-4-4c1.1 0 2.1.45 2.83 1.17L11 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M11 2v3H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  heading,
  items,
  accent,
  icon,
}: {
  heading: string;
  items: string[];
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[11px] font-mono text-slate-300 tracking-[0.12em] uppercase font-semibold">
          {heading}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
              style={{ background: accent, opacity: 0.7 }}
            />
            <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Empty states ──────────────────────────────────────────────────────────────

function NoBrainState({ hasGithubToken }: { hasGithubToken: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-5 py-16 px-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ border: "1px solid rgba(34,211,238,0.2)", background: "rgba(34,211,238,0.05)" }}
      >
        <span className="text-[#22d3ee]/50">
          <SparkleIcon size={16} />
        </span>
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-base font-semibold text-slate-200">No brain connected yet</p>
        {!hasGithubToken ? (
          <p className="text-sm text-slate-400 leading-relaxed">
            Connect GitHub so your agent has a place to learn.{" "}
            <a href="/api/app/auth/github?next=/app/brain/digest" className="text-[#22d3ee] hover:underline">
              Connect GitHub →
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">
            Set up your brain and the weekly read will summarize what your agent knows.{" "}
            <a href="/app/onboarding" className="text-[#22d3ee] hover:underline">
              Set up brain →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function NoApiKeyState() {
  return (
    <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 p-5 flex flex-col gap-3">
      <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key to generate the digest.</p>
      <p className="text-sm text-slate-300 leading-relaxed">
        The weekly read uses your own API key — your data stays yours.{" "}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#22d3ee] hover:underline"
        >
          Get a key →
        </a>
      </p>
      <a
        href="/app/settings"
        className="inline-flex items-center gap-2 self-start rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
      >
        Go to Settings →
      </a>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DigestClient({
  brainRepo,
  hasApiKey,
  hasGithubToken,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
  hasGithubToken: boolean;
}) {
  const [digest, setDigest] = useState<DigestPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback((method: "GET" | "POST") => {
    const isRefresh = method === "POST";
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    fetch("/api/app/brain/digest", { method })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((d: { error?: string }) => {
            throw new Error(d.error ?? `${r.status}`);
          });
        }
        return r.json() as Promise<DigestResponse>;
      })
      .then((d) => {
        setDigest(d.digest);
        setFromCache(d.cached);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Generation failed";
        setError(msg);
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    if (brainRepo && hasApiKey) load("GET");
  }, [brainRepo, hasApiKey, load]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-100">Weekly Read</h1>
              <span className="text-[#22d3ee]/60">
                <SparkleIcon size={13} />
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              What your agent learned, what&apos;s waiting on you, and what to add next
            </p>
          </div>

          {brainRepo && hasApiKey && (
            <button
              onClick={() => load("POST")}
              disabled={refreshing || loading}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <RefreshIcon spinning={refreshing} />
              {refreshing ? "Generating…" : "Refresh"}
            </button>
          )}
        </div>

        {/* Nav breadcrumb */}
        <a href="/app/brain" className="self-start text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M7 2L4 5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Brain health
        </a>

        {/* Body */}
        {!brainRepo ? (
          <NoBrainState hasGithubToken={hasGithubToken} />
        ) : !hasApiKey ? (
          <NoApiKeyState />
        ) : loading ? (
          <div className="flex flex-col items-center gap-4 py-14">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ border: "1px solid rgba(34,211,238,0.25)" }}
            >
              <span className="text-[#22d3ee]/70 animate-pulse">
                <SparkleIcon size={16} />
              </span>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm text-slate-300">Your agent is reading its brain…</p>
              <p className="text-[11px] font-mono text-slate-500">
                This takes 10–30 seconds on first load.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-200">Couldn&apos;t generate the digest.</p>
            <p className="text-xs text-slate-400 font-mono break-words">{error}</p>
            <button
              onClick={() => load("POST")}
              className="self-start text-sm text-[#22d3ee] hover:underline font-mono"
            >
              Try again →
            </button>
          </div>
        ) : digest ? (
          <div className="flex flex-col gap-4">
            {/* Timestamp + cache note */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-mono text-slate-600">
                Generated {formatTimestamp(digest.generatedAt)}
                {fromCache && <span className="ml-1 text-slate-700">· cached</span>}
              </p>
              {digest.fileCount > 0 && (
                <span className="text-[10px] font-mono text-slate-600">
                  {digest.fileCount} memory file{digest.fileCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Three sections */}
            <SectionCard
              heading={digest.learned.heading}
              items={digest.learned.items}
              accent="#22d3ee"
              icon={<SparkleIcon size={12} />}
            />

            <SectionCard
              heading={digest.pending.heading}
              items={digest.pending.items}
              accent="#f59e0b"
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M6 3.5v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              }
            />

            <SectionCard
              heading={digest.suggestions.heading}
              items={digest.suggestions.items}
              accent="#34d399"
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              }
            />

            {/* Feed CTA */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-800/40 bg-slate-900/20 px-4 py-3">
              <p className="text-[11px] font-mono text-slate-600 leading-relaxed flex-1">
                Add more context to make next week&apos;s read sharper.
              </p>
              <a
                href="/app/capture"
                className="shrink-0 text-[11px] font-mono text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors"
              >
                Feed brain →
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
