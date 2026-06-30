"use client";

// BrowserPermissionsClient — the live per-domain rules UI. Lists the owner's allow/deny rules with
// their Trust-Ladder progress, lets them add a rule, and exposes the auto-approve toggle ONLY once a
// domain has cleared the ladder (the server enforces the same rule on write — this is the friendly
// front of that gate). Plain fetch + raw Tailwind (the repo has no src/components/ui kit).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Permission = {
  domain: string;
  decision: "allow" | "deny";
  autoApprove: boolean;
  manualApprovals: number;
  unlockAvailable: boolean;
  approvalsUntilUnlock: number;
  updatedAt: string;
};

type GetResponse = { permissions: Permission[]; trustLadderThreshold: number };

export default function BrowserPermissionsClient(): JSX.Element {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [decisionInput, setDecisionInput] = useState<"allow" | "deny">("allow");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/app/browser/permissions", { cache: "no-store" });
      const data = (await res.json()) as GetResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Failed to load (${res.status})`);
      setPermissions(data.permissions);
      setThreshold(data.trustLadderThreshold);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(domain: string, decision: "allow" | "deny", autoApprove: boolean): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/browser/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, decision, autoApprove }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      await load();
      setDomainInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/app/settings" className="text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee]">
          ← Settings
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">Browser permissions</h1>
        <p className="mt-1 text-sm text-slate-400">
          Decide which sites Pocket Agent may drive in its hidden browser. Every action is gated for your
          approval by default. After {threshold} manual approvals for a site, you can let actions on it run
          on their own (the Trust Ladder).
        </p>
      </div>

      {/* Add a rule */}
      <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">Add a rule</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="quickbooks.com"
            className="flex-1 rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
          />
          <select
            value={decisionInput}
            onChange={(e) => setDecisionInput(e.target.value as "allow" | "deny")}
            className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:border-[#22d3ee]/50 focus:outline-none"
          >
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
          </select>
          <button
            type="button"
            disabled={saving || domainInput.trim().length === 0}
            onClick={() => void save(domainInput, decisionInput, false)}
            className="rounded-lg bg-[#22d3ee]/90 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[#22d3ee] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Forbidden sites (openai.com, anthropic.com, claude.ai) and any money-movement action are always
          refused — no rule can override that.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : permissions.length === 0 ? (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-8 text-center text-sm text-slate-400">
          No site rules yet. By default every site is allowed but every action waits for your approval.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {permissions.map((p) => (
            <div
              key={p.domain}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-200">{p.domain}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                      p.decision === "deny"
                        ? "border-red-500/30 bg-red-500/15 text-red-300"
                        : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    {p.decision}
                  </span>
                  {p.autoApprove && (
                    <span className="rounded border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-1.5 py-0.5 text-[10px] uppercase text-[#22d3ee]">
                      auto-approve
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {p.manualApprovals} manual approval{p.manualApprovals === 1 ? "" : "s"}
                  {p.decision === "allow" && !p.unlockAvailable
                    ? ` · ${p.approvalsUntilUnlock} more to unlock auto-approve`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {p.decision === "allow" && (
                  <button
                    type="button"
                    disabled={saving || (!p.autoApprove && !p.unlockAvailable)}
                    onClick={() => void save(p.domain, "allow", !p.autoApprove)}
                    title={
                      !p.autoApprove && !p.unlockAvailable
                        ? `Unlocks after ${threshold} manual approvals`
                        : undefined
                    }
                    className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-40"
                  >
                    {p.autoApprove ? "Turn off auto-approve" : "Turn on auto-approve"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(p.domain, p.decision === "deny" ? "allow" : "deny", false)}
                  className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-40"
                >
                  {p.decision === "deny" ? "Allow" : "Deny"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
