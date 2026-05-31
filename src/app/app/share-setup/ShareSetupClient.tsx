"use client";

import { useState, useCallback } from "react";

const INBOX_ENDPOINT = "https://aipocketagent.com/api/app/share/inbox";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; fallback is silent — user sees button unchanged
    }
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 text-[10px] font-mono px-2 py-1 rounded border border-slate-700/60 text-slate-400 hover:text-[#22d3ee] hover:border-[#22d3ee]/40 transition-colors min-h-[32px] min-w-[52px]"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeSnip({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2.5">
      <code className="flex-1 text-[11px] font-mono text-slate-300 break-all leading-relaxed select-all">
        {children}
      </code>
      <CopyButton text={children} />
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/8 flex items-center justify-center">
      <span className="text-[11px] font-mono text-[#22d3ee]">{n}</span>
    </div>
  );
}

type TokenState =
  | { phase: "idle"; hasToken: boolean; lastUsedAt: string | null }
  | { phase: "loading" }
  | { phase: "revealed"; token: string }
  | { phase: "error"; message: string };

export default function ShareSetupClient({
  hasToken: initialHasToken,
  lastUsedAt,
}: {
  hasToken: boolean;
  lastUsedAt: string | null;
}) {
  const [state, setState] = useState<TokenState>({
    phase: "idle",
    hasToken: initialHasToken,
    lastUsedAt,
  });

  const generateToken = useCallback(async (action: "generate" | "regenerate") => {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/app/share/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        setState({ phase: "error", message: body.error ?? "Something went wrong. Try again." });
        return;
      }
      setState({ phase: "revealed", token: body.token });
    } catch {
      setState({ phase: "error", message: "Network error. Check your connection and try again." });
    }
  }, []);

  const bodyJson = `{"kind":"url","content":"Shortcut Input","sourceUrl":"Shortcut Input"}`;

  const lastUsedLabel = (() => {
    if (!lastUsedAt) return null;
    const d = new Date(lastUsedAt);
    return `Last used ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-xl mx-auto px-5 py-8 flex flex-col gap-7">

        {/* Header */}
        <div>
          <div className="text-[#22d3ee] text-[10px] font-mono tracking-[0.22em] uppercase mb-1.5">
            Pocket Agent · iOS Share
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Share to your brain.</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Share any URL, article, or text from any iOS app directly into your brain inbox
            with one tap — no copy-paste, no friction.
          </p>
        </div>

        {/* Step 1 — Token */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-5 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StepBadge n={1} />
            <span className="text-sm font-semibold text-slate-200">Generate your share token</span>
          </div>

          {state.phase === "idle" && !state.hasToken && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Your share token is a secret credential that lets the iOS Shortcut authenticate as
                you. Generate it once and paste it into the Shortcut.
              </p>
              <button
                onClick={() => generateToken("generate")}
                className="self-start px-4 py-2 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee] text-sm font-semibold hover:bg-[#22d3ee]/20 transition-colors min-h-[40px]"
              >
                Generate share token
              </button>
            </div>
          )}

          {state.phase === "idle" && state.hasToken && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#22d3ee] font-mono">◈</span>
                <span className="text-xs font-medium text-slate-300">Your share token is set up.</span>
                {lastUsedLabel && (
                  <span className="ml-auto text-[10px] font-mono text-slate-600">{lastUsedLabel}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                The token value is never shown again for security. If you need to replace it (e.g.
                you think it was exposed), regenerate it — the old one stops working immediately.
              </p>
              <button
                onClick={() => generateToken("regenerate")}
                className="self-start px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-500 text-xs hover:text-slate-300 hover:border-slate-600 transition-colors min-h-[36px]"
              >
                Regenerate token (revokes old)
              </button>
            </div>
          )}

          {state.phase === "loading" && (
            <p className="text-xs text-slate-500 font-mono animate-pulse">Generating…</p>
          )}

          {state.phase === "error" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-red-400">{state.message}</p>
              <button
                onClick={() => setState({ phase: "idle", hasToken: initialHasToken, lastUsedAt })}
                className="self-start text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {state.phase === "revealed" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/6 px-3 py-2">
                <p className="text-xs font-semibold text-amber-300">Copy this now — it won&apos;t be shown again.</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  This token acts like a password. Don&apos;t paste it in public places.
                </p>
              </div>
              <CodeSnip>{state.token}</CodeSnip>
              <p className="text-[11px] text-slate-600">
                Paste this into the Shortcut in Step 2 wherever you see <span className="font-mono text-slate-500">YOUR_TOKEN</span>.
              </p>
            </div>
          )}
        </div>

        {/* Step 2 — Build the Shortcut */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-5 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <StepBadge n={2} />
            <span className="text-sm font-semibold text-slate-200">Build the Shortcut once</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Open the <span className="text-slate-300">Shortcuts</span> app on your iPhone, tap{" "}
            <span className="text-slate-300">+</span> to create a new shortcut, and add these
            four actions in order:
          </p>

          <div className="flex flex-col gap-3">

            {/* Action 1 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 mt-0.5 rounded bg-slate-800 flex items-center justify-center">
                <span className="text-[9px] font-mono text-slate-500">1</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-300">Receive Any input from Share Sheet</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add action → search <span className="font-mono">receive</span> → &ldquo;Receive input from
                  Share Sheet&rdquo;. Set type to <span className="font-mono">Any</span>.
                </p>
              </div>
            </div>

            {/* Action 2 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 mt-0.5 rounded bg-slate-800 flex items-center justify-center">
                <span className="text-[9px] font-mono text-slate-500">2</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-300">Get Contents of URL (POST)</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-2">
                  Add action → search <span className="font-mono">URL</span> → &ldquo;Get Contents of URL&rdquo;.
                  Set <span className="font-mono">Method</span> to <span className="font-mono">POST</span>.
                </p>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] font-mono text-slate-600 mb-1 uppercase tracking-[0.1em]">URL</p>
                    <CodeSnip>{INBOX_ENDPOINT}</CodeSnip>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-slate-600 mb-1 uppercase tracking-[0.1em]">Headers (add two)</p>
                    <div className="space-y-1.5">
                      <CodeSnip>Authorization: Bearer YOUR_TOKEN</CodeSnip>
                      <CodeSnip>Content-Type: application/json</CodeSnip>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-slate-600 mb-1 uppercase tracking-[0.1em]">
                      Request Body → JSON
                    </p>
                    <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <code className="text-[10px] font-mono text-slate-300">kind</code>
                        <code className="text-[10px] font-mono text-slate-500">url</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <code className="text-[10px] font-mono text-slate-300">content</code>
                        <code className="text-[10px] font-mono text-[#22d3ee]/70">Shortcut Input</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <code className="text-[10px] font-mono text-slate-300">sourceUrl</code>
                        <code className="text-[10px] font-mono text-[#22d3ee]/70">Shortcut Input</code>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">
                      Set <span className="font-mono">content</span> and <span className="font-mono">sourceUrl</span> to
                      the magic variable <span className="font-mono text-[#22d3ee]/50">Shortcut Input</span> (tap the field → &ldquo;Shortcut Input&rdquo; from the menu).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action 3 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 mt-0.5 rounded bg-slate-800 flex items-center justify-center">
                <span className="text-[9px] font-mono text-slate-500">3</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-300">Show Notification</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add action → search <span className="font-mono">notification</span>. Set body to:
                </p>
                <div className="mt-1.5">
                  <CodeSnip>Sent to your brain</CodeSnip>
                </div>
              </div>
            </div>
          </div>

          {/* Full JSON body reference */}
          <div className="border-t border-slate-800/60 pt-3">
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.1em] mb-2">
              Full JSON body (for reference)
            </p>
            <CodeSnip>{bodyJson}</CodeSnip>
          </div>
        </div>

        {/* Step 3 — Using it */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <StepBadge n={3} />
            <span className="text-sm font-semibold text-slate-200">Share anything in two taps</span>
          </div>
          <ol className="flex flex-col gap-2">
            {[
              "Find any article, URL, or text in any iOS app.",
              "Tap the Share icon.",
              "Scroll to your Shortcut and tap it.",
              "Done — it lands in your brain inbox.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-[#22d3ee]/50 font-mono shrink-0 mt-0.5">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>

          <div className="border-t border-slate-800/60 pt-3 flex flex-col gap-1.5">
            <p className="text-[11px] font-mono text-slate-600 uppercase tracking-[0.1em]">
              Verify in your brain
            </p>
            <a
              href="/app/documents"
              className="text-xs text-[#22d3ee] hover:underline font-mono"
            >
              Browse documents → memory/inbox.md →
            </a>
            <p className="text-xs text-slate-600 leading-relaxed">
              Shared items pile up there as markdown bullets. Triage them when you&apos;re ready — move the
              useful ones into proper memory files, delete the rest.
            </p>
          </div>
        </div>

        {/* Link back */}
        <div className="pb-4">
          <a href="/app/capture" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono">
            ← Back to Capture
          </a>
        </div>
      </div>
    </div>
  );
}
