"use client";

// RoutingRulesSection — the capture routing-rules CRUD, relocated into Captures settings (the Capture
// Inbox App was retired and folded in here). The owner authors deterministic rules that file a capture
// straight into a dedicated brain path instead of leaving it in the feed. A rule matches when every
// condition it sets matches; rules are tried highest-priority first, and the first match wins. The
// weekly Monday triage sweep + cleanup pass that round out the inbox behaviors still run behind the
// scenes — this surface just owns the rules. Backed by the unchanged
// /api/app/settings/capture-routing endpoints (relocated view, same API).

import { useCallback, useEffect, useState } from "react";

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
  if (p.keywords && p.keywords.length > 0)
    parts.push(`mentions ${p.keywords.map((k) => `“${k}”`).join(" or ")}`);
  if (p.sourceUrlContains) parts.push(`link contains “${p.sourceUrlContains}”`);
  if (p.contentType) parts.push(`it's a ${p.contentType}`);
  if (p.regex) parts.push(`matches /${p.regex}/`);
  return parts.length > 0 ? parts.join(" · ") : "always";
}

const inputClass =
  "w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none";

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
      <span className="text-[11px] leading-relaxed text-slate-600">{hint}</span>
    </label>
  );
}

export default function RoutingRulesSection() {
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
    <section id="routing-rules" className="scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-base">
          🗂️
        </span>
        <h2 className="text-sm font-bold text-slate-100">Routing rules</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        Auto-file captures by keyword, regex, source, or content type. A rule fires when every
        condition you set is true — higher priority is tried first, and the first match wins. Whatever
        no rule catches waits for the weekly Monday sweep to sort.
      </p>

      {/* Add a rule */}
      <div className="mb-4 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-4">
        <p className="mb-4 text-sm font-semibold text-slate-100">Add a rule</p>

        <div className="flex flex-col gap-4">
          <Field label="Keywords" hint="Comma-separated. Fires if the item mentions any one of them.">
            <input
              type="text"
              value={draft.keywords}
              onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
              placeholder="pricing, launch, competitor"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              className="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add rule"}
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-3">
          <p className="text-sm text-rose-300">{err}</p>
        </div>
      )}

      {/* Existing rules */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-5 py-8 text-center">
          <p className="mb-1.5 text-sm font-semibold text-slate-200">No rules yet</p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-500">
            Add your first rule above. Until then, everything you capture waits in your feed for the
            Monday sweep to sort.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-200">
                  When{" "}
                  <span className="font-medium text-slate-100">
                    {describePattern(rule.match_pattern)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  file into <span className="font-mono text-cyan-300/80">{rule.target_path}</span>
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-slate-600">priority {rule.priority}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(rule)}
                  disabled={busyId === rule.id}
                  className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider disabled:opacity-50 ${
                    rule.enabled
                      ? "border-cyan-400/30 bg-cyan-500/5 text-cyan-300"
                      : "border-slate-700 bg-transparent text-slate-500"
                  }`}
                >
                  {rule.enabled ? "on" : "off"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(rule)}
                  disabled={busyId === rule.id}
                  className="text-xs text-slate-600 transition-colors hover:text-rose-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
