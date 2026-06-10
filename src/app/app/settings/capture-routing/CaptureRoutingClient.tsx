"use client";

// Capture routing settings (PA-CAPTURE-1). The owner authors deterministic rules that file a shared
// item straight into a dedicated brain path instead of leaving it in the inbox. A rule matches when
// every condition it sets matches; rules are tried highest-priority first, and the first match wins.
// This is the home surface for the Capture Inbox App, so the intro also names the weekly triage sweep
// and the cleanup pass that round out the three behaviors.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type MatchPattern = {
  keywords?: string[];
  regex?: string;
  sourceUrlContains?: string;
  contentType?: "text" | "url" | "note" | "voice";
};

type Rule = {
  id: string;
  match_pattern: MatchPattern;
  target_path: string;
  enabled: boolean;
  priority: number;
  created_at: string;
};

type RuleDraft = {
  keywords: string;
  sourceUrlContains: string;
  contentType: "" | "text" | "url" | "note" | "voice";
  regex: string;
  targetPath: string;
  priority: string;
};

const EMPTY_DRAFT: RuleDraft = {
  keywords: "",
  sourceUrlContains: "",
  contentType: "",
  regex: "",
  targetPath: "",
  priority: "0",
};

function describePattern(p: MatchPattern): string {
  const parts: string[] = [];
  if (p.keywords && p.keywords.length > 0) parts.push(`mentions ${p.keywords.map((k) => `“${k}”`).join(" or ")}`);
  if (p.sourceUrlContains) parts.push(`link contains “${p.sourceUrlContains}”`);
  if (p.contentType) parts.push(`it's a ${p.contentType}`);
  if (p.regex) parts.push(`matches /${p.regex}/`);
  return parts.length > 0 ? parts.join(" · ") : "always";
}

export default function CaptureRoutingClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/app/settings/capture-routing", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { rules: Rule[] };
      setRules(data.rules);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function buildPattern(d: RuleDraft): MatchPattern {
    const pattern: MatchPattern = {};
    const kws = d.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (kws.length > 0) pattern.keywords = kws;
    if (d.sourceUrlContains.trim()) pattern.sourceUrlContains = d.sourceUrlContains.trim();
    if (d.contentType) pattern.contentType = d.contentType;
    if (d.regex.trim()) pattern.regex = d.regex.trim();
    return pattern;
  }

  async function addRule() {
    setErr(null);
    const pattern = buildPattern(draft);
    if (Object.keys(pattern).length === 0) {
      setErr("Add at least one match condition.");
      return;
    }
    if (!draft.targetPath.trim()) {
      setErr("Give the rule a brain path to file into.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/app/settings/capture-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchPattern: pattern,
          targetPath: draft.targetPath.trim(),
          priority: Number(draft.priority) || 0,
        }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; rule?: Rule };
      if (!res.ok || !data.rule) throw new Error(data.error ?? `Failed (${res.status})`);
      setRules((prev) => [...prev, data.rule as Rule]);
      setDraft(EMPTY_DRAFT);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the rule");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: Rule) {
    setBusyId(rule.id);
    setErr(null);
    try {
      const res = await fetch(`/api/app/settings/capture-routing/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; rule?: Rule };
      if (!res.ok || !data.rule) throw new Error(data.error ?? `Failed (${res.status})`);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? (data.rule as Rule) : r)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: Rule) {
    setBusyId(rule.id);
    setErr(null);
    try {
      const res = await fetch(`/api/app/settings/capture-routing/${rule.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't delete the rule");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...rules].sort(
    (a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at),
  );

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        <div className="mb-2">
          <Link
            href="/app/settings"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Settings
          </Link>
        </div>

        <div className="mb-7">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Capture Inbox
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Capture routing</h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Everything you tap, talk, or share into your brain lands in one inbox first. Set a rule
            here and the obvious stuff files itself — a competitor&apos;s link straight to your
            competitor notes, a customer quote into your testimonials. Each Monday, your agent reads
            whatever&apos;s left, suggests where each one belongs, and you approve it with a tap. Once
            something is filed, it clears out of the inbox so the list stays short.
          </p>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            A rule fires when every condition you set is true. Rules with a higher priority are tried
            first, and the first one that matches wins.
          </p>
        </div>

        {/* Add a rule */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5 py-5 mb-7">
          <p className="text-sm font-semibold text-slate-100 mb-4">Add a rule</p>

          <div className="flex flex-col gap-4">
            <Field
              label="Keywords"
              hint="Comma-separated. Fires if the item mentions any one of them."
            >
              <input
                type="text"
                value={draft.keywords}
                onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                placeholder="pricing, launch, competitor"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Link contains" hint="A substring of the shared URL.">
                <input
                  type="text"
                  value={draft.sourceUrlContains}
                  onChange={(e) => setDraft({ ...draft, sourceUrlContains: e.target.value })}
                  placeholder="youtube.com"
                  className={inputClass}
                />
              </Field>

              <Field label="Type" hint="Only this kind of capture.">
                <select
                  value={draft.contentType}
                  onChange={(e) =>
                    setDraft({ ...draft, contentType: e.target.value as RuleDraft["contentType"] })
                  }
                  className={inputClass}
                >
                  <option value="">Any</option>
                  <option value="url">Link</option>
                  <option value="text">Text</option>
                  <option value="note">Note</option>
                  <option value="voice">Voice</option>
                </select>
              </Field>
            </div>

            <Field
              label="Pattern (advanced)"
              hint="A regular expression to match against the item's text. Leave blank if you're not sure."
            >
              <input
                type="text"
                value={draft.regex}
                onChange={(e) => setDraft({ ...draft, regex: e.target.value })}
                placeholder="(invoice|receipt)"
                className={`${inputClass} font-mono`}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Field label="File into" hint="A folder, or a .md file to append to.">
                  <input
                    type="text"
                    value={draft.targetPath}
                    onChange={(e) => setDraft({ ...draft, targetPath: e.target.value })}
                    placeholder="brain/competitive"
                    className={`${inputClass} font-mono`}
                  />
                </Field>
              </div>
              <Field label="Priority" hint="Higher runs first.">
                <input
                  type="number"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void addRule()}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Add rule"}
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-5 py-3 mb-5">
            <p className="text-red-400 text-sm font-mono">{err}</p>
          </div>
        )}

        {/* Existing rules */}
        {loading ? (
          <p className="text-sm font-mono text-slate-500">loading…</p>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-slate-100 text-base font-semibold mb-2">No rules yet</p>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
              Add your first rule above. Until then, everything you capture waits in the inbox for the
              Monday sweep to sort.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 py-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">
                    When <span className="text-slate-100 font-medium">{describePattern(rule.match_pattern)}</span>
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    file into <span className="font-mono text-[#22d3ee]/80">{rule.target_path}</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-600 mt-1.5">priority {rule.priority}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => void toggle(rule)}
                    disabled={busyId === rule.id}
                    className={`text-[10px] font-mono border rounded px-2 py-1 uppercase tracking-wider disabled:opacity-50 ${
                      rule.enabled
                        ? "text-[#22d3ee] border-[#22d3ee]/30 bg-[#22d3ee]/5"
                        : "text-slate-500 border-slate-700 bg-transparent"
                    }`}
                  >
                    {rule.enabled ? "on" : "off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(rule)}
                    disabled={busyId === rule.id}
                    className="text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      {children}
      <span className="text-[11px] text-slate-600 leading-relaxed">{hint}</span>
    </label>
  );
}
