"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ZoneRow = { name: string; patterns: string };

// Mirrors DEFAULT_ZONE_CONFIG in lib/brain/containment-guard.ts.
const KNOWN_ZONE_HELP: Record<string, string> = {
  "user-private": "Files here are blocked from the agent unless you open or share them explicitly.",
  "project-shared": "Files here are freely readable by your agent.",
};

function toRows(zones: Record<string, string[]>): ZoneRow[] {
  return Object.entries(zones).map(([name, patterns]) => ({
    name,
    patterns: patterns.join("\n"),
  }));
}

function fromRows(rows: ZoneRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    out[name] = row.patterns
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return out;
}

export default function PrivacyZonesClient({ hasGithubToken }: { hasGithubToken: boolean }) {
  const [rows, setRows] = useState<ZoneRow[] | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/app/settings/privacy-zones");
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = (await res.json()) as {
          config: { zones: Record<string, string[]> };
          isDefault: boolean;
        };
        setRows(toRows(data.config.zones));
        setIsDefault(data.isDefault);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load privacy zones");
        setRows([]);
      }
    })();
  }, []);

  function setRow(idx: number, patch: Partial<ZoneRow>) {
    setRows((r) => (r ? r.map((row, i) => (i === idx ? { ...row, ...patch } : row)) : r));
    setSaved(false);
  }

  function addZone() {
    setRows((r) => [...(r ?? []), { name: "", patterns: "" }]);
    setSaved(false);
  }

  function removeZone(idx: number) {
    setRows((r) => (r ? r.filter((_, i) => i !== idx) : r));
    setSaved(false);
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    try {
      const zones = fromRows(rows);
      const res = await fetch("/api/app/settings/privacy-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSaved(true);
      setIsDefault(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!hasGithubToken) {
    return (
      <Shell>
        <p className="text-sm text-slate-400">
          Connect GitHub to manage privacy zones.{" "}
          <a href="/api/app/auth/github?next=/app/settings/privacy-zones" className="text-[#22d3ee] hover:underline">
            Connect GitHub →
          </a>
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm text-slate-400">
        Privacy zones decide which parts of your brain your agent can read. Files in a private zone are
        kept out of the agent&apos;s context unless you open or share them explicitly. Patterns use{" "}
        <span className="font-mono text-slate-300">glob</span> syntax (e.g.{" "}
        <span className="font-mono text-slate-300">finance/**</span>).
      </p>

      {isDefault && (
        <div className="rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-4 py-3">
          <p className="text-xs text-[#22d3ee]/90">
            You haven&apos;t set up zones yet — these are sensible defaults. Save to write them to your brain
            as <span className="font-mono">brain-containment.json</span>.
          </p>
        </div>
      )}

      {rows === null ? (
        <p className="text-[12px] font-mono text-slate-500">loading zones…</p>
      ) : loadError ? (
        <p className="text-xs text-red-400">{loadError}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row, idx) => {
            const isPrivate = row.name.trim() !== "" && row.name.trim() !== "project-shared";
            return (
              <div key={idx} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => setRow(idx, { name: e.target.value })}
                    placeholder="zone-name"
                    className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm font-mono text-slate-200 focus:border-[#22d3ee]/50 focus:outline-none"
                  />
                  <span
                    className={`text-[10px] font-mono px-2 py-1 rounded shrink-0 ${
                      isPrivate
                        ? "text-amber-300 bg-amber-500/10 border border-amber-500/30"
                        : "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                    }`}
                  >
                    {isPrivate ? "private" : "shared"}
                  </span>
                  <button
                    onClick={() => removeZone(idx)}
                    className="text-slate-500 hover:text-red-400 px-2 shrink-0"
                    aria-label="Remove zone"
                  >
                    ✕
                  </button>
                </div>
                {KNOWN_ZONE_HELP[row.name.trim()] && (
                  <p className="text-[11px] text-slate-500">{KNOWN_ZONE_HELP[row.name.trim()]}</p>
                )}
                <textarea
                  value={row.patterns}
                  onChange={(e) => setRow(idx, { patterns: e.target.value })}
                  rows={3}
                  placeholder={"personal/**\nfinance/**"}
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs font-mono text-slate-200 focus:border-[#22d3ee]/50 focus:outline-none resize-y"
                />
              </div>
            );
          })}

          <button
            onClick={addZone}
            className="self-start rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-700/60"
          >
            + Add zone
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || rows === null}
          className="rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-5 py-2.5 text-sm font-mono text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save zones"}
        </button>
        {saved && <span className="text-xs font-mono text-emerald-400">Saved ✓</span>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">
        <div>
          <Link href="/app/settings" className="text-[11px] font-mono text-slate-500 hover:text-slate-300">
            ← Settings
          </Link>
          <h1 className="text-lg font-semibold text-slate-100 mt-2">Privacy zones</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Control which brain files your agent is allowed to read.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
