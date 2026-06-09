"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadScoutSchedule, LeadScoutSourceKind } from "@/lib/leads/types";

export type SourceView = {
  id: string;
  name: string;
  kind: LeadScoutSourceKind;
  schedule: LeadScoutSchedule;
  projectId: string | null;
  /** One-line description of what the source pulls — "12 URLs" or "roofing · Knoxville, TN". */
  detail: string;
  lastRun: { id: string; createdAt: string; leadCount: number; status: string } | null;
};

// Quick-pick categories for the Maps sweep — the owner can type anything, these just seed the field.
const CATEGORY_SUGGESTIONS = ["roofing", "HVAC", "painting", "restaurants", "med spa", "law firm"];

const SCHEDULE_LABEL: Record<LeadScoutSchedule, string> = {
  on_demand: "On demand",
  daily: "Daily",
  weekly: "Weekly",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none";
const LABEL_CLASS = "text-[11px] font-mono text-slate-400 uppercase tracking-wider";

function NewSourceSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<LeadScoutSourceKind>("google_maps");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<LeadScoutSchedule>("on_demand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ url: string; reason: string }[]>([]);

  // URL-list fields
  const [urls, setUrls] = useState("");
  const [pattern, setPattern] = useState("");

  // Google Maps fields
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState(25);
  const [noWebsite, setNoWebsite] = useState(true);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [minReviews, setMinReviews] = useState("");
  const [maxReviews, setMaxReviews] = useState("");

  function bodyFor(): Record<string, unknown> {
    if (kind === "google_maps") {
      return {
        kind: "google_maps",
        name: name.trim(),
        category: category.trim(),
        location: location.trim(),
        radiusMiles: radius,
        filters: {
          noWebsite,
          hasPhone,
          hasEmail,
          minReviews: minReviews.trim() ? Number(minReviews) : null,
          maxReviews: maxReviews.trim() ? Number(maxReviews) : null,
        },
        schedule,
      };
    }
    const urlList = urls
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
    return { kind: "url_list", name: name.trim(), extractionPattern: pattern.trim(), urls: urlList, schedule };
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setRejected([]);
    try {
      const res = await fetch("/api/app/apps/lead-scout/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyFor()),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        rejected?: { url: string; reason: string }[];
      };
      if (!res.ok) {
        setError(body.error ?? "Couldn't create the source.");
        if (body.rejected) setRejected(body.rejected);
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    (kind === "google_maps"
      ? category.trim().length > 0 && location.trim().length > 0
      : pattern.trim().length > 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-[#0a0d12] p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-100">New Lead Source</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Kind picker — both Phase 1 (URL list) and Phase 2 (Google Maps) are live. */}
          <div>
            <label className={LABEL_CLASS}>What kind of source</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("google_maps")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  kind === "google_maps"
                    ? "border-[#22d3ee]/40 bg-[#22d3ee]/5 text-slate-100"
                    : "border-slate-800/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="block font-semibold">Google Maps sweep</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">Pick a category + place</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("url_list")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  kind === "url_list"
                    ? "border-[#22d3ee]/40 bg-[#22d3ee]/5 text-slate-100"
                    : "border-slate-800/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="block font-semibold">URL list</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">Paste links to visit</span>
              </button>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Knoxville roofers — Q3 outreach"
              className={FIELD_CLASS}
            />
          </div>

          {kind === "google_maps" ? (
            <>
              <div>
                <label className={LABEL_CLASS}>Category</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  list="ls-category-suggestions"
                  placeholder="roofing"
                  className={FIELD_CLASS}
                />
                <datalist id="ls-category-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className="text-[11px] rounded-full border border-slate-700/70 px-2.5 py-1 text-slate-400 hover:border-[#22d3ee]/40 hover:text-slate-200 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS}>Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Knoxville, TN"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Radius — {radius} miles</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="mt-2 w-full accent-[#22d3ee]"
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Filters</label>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noWebsite}
                      onChange={(e) => setNoWebsite(e.target.checked)}
                      className="accent-[#22d3ee] h-4 w-4"
                    />
                    <span className="text-sm text-slate-100">
                      Only businesses without a website
                      <span className="block text-[11px] text-slate-500">
                        The headline — a Facebook page doesn&apos;t count as a website.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 px-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPhone}
                      onChange={(e) => setHasPhone(e.target.checked)}
                      className="accent-[#22d3ee] h-4 w-4"
                    />
                    <span className="text-sm text-slate-300">Has a phone number</span>
                  </label>
                  <label className="flex items-center gap-2.5 px-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasEmail}
                      onChange={(e) => setHasEmail(e.target.checked)}
                      className="accent-[#22d3ee] h-4 w-4"
                    />
                    <span className="text-sm text-slate-300">Has an email</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Min reviews</label>
                  <input
                    type="number"
                    min={0}
                    value={minReviews}
                    onChange={(e) => setMinReviews(e.target.value)}
                    placeholder="any"
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Max reviews</label>
                  <input
                    type="number"
                    min={0}
                    value={maxReviews}
                    onChange={(e) => setMaxReviews(e.target.value)}
                    placeholder="any"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={LABEL_CLASS}>URL list</label>
                <textarea
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  rows={5}
                  placeholder={"One URL per line:\nhttps://example-roofing.com\nhttps://another-contractor.com"}
                  className={`${FIELD_CLASS} leading-relaxed resize-y font-mono`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>What to extract</label>
                <textarea
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  rows={3}
                  placeholder="Describe what to extract — name, owner, phone, what they do, and whether they look like a fit for roofing supplements."
                  className={`${FIELD_CLASS} leading-relaxed resize-y`}
                />
              </div>
            </>
          )}

          <div>
            <label className={LABEL_CLASS}>Schedule</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as LeadScoutSchedule)}
              className={FIELD_CLASS}
            >
              <option value="on_demand">On demand — I run it</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {rejected.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-red-400/90">
              {rejected.map((r, i) => (
                <li key={i} className="font-mono truncate">
                  {r.url} — {r.reason}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="min-h-[44px] rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Creating…" : "Create Lead Source"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ source, connected }: { source: SourceView; connected: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranOk, setRanOk] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setRanOk(false);
    try {
      const res = await fetch(`/api/app/apps/lead-scout/sources/${source.id}/run`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Run failed.");
        return;
      }
      setRanOk(true);
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100 truncate">{source.name}</p>
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]/70 border border-[#22d3ee]/20 rounded px-1.5 py-0.5">
              {source.kind === "google_maps" ? "Maps" : "URLs"}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {source.detail} · {SCHEDULE_LABEL[source.schedule]}
            {source.lastRun
              ? ` · ${source.lastRun.leadCount} leads, last run ${relativeTime(source.lastRun.createdAt)}`
              : " · never run"}
          </p>
        </div>
        {source.projectId && (
          <Link
            href={`/app/projects/${source.projectId}`}
            className="shrink-0 text-[11px] font-mono text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors"
          >
            Open project →
          </Link>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>}
      {ranOk && (
        <p className="mt-3 text-xs text-[#22d3ee]/90">
          Run finished —{" "}
          <Link href="/app/mission-control" className="underline hover:text-[#22d3ee]">
            see the batch in Mission Control →
          </Link>
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={run}
          disabled={running || !connected}
          title={connected ? undefined : "Connect Bright Data in Settings → Connections first."}
          className="min-h-[40px] px-4 rounded-xl bg-[#22d3ee] hover:bg-[#06b6d4] text-[#031820] text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Scouting…" : "Run now"}
        </button>
        {!connected && <span className="text-[11px] text-slate-600">Connect Bright Data to run.</span>}
      </div>
    </div>
  );
}

export default function LeadScoutClient({
  sources,
  connected,
}: {
  sources: SourceView[];
  connected: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-mono text-slate-400 tracking-[0.14em] uppercase font-semibold">
          Your Lead Sources
        </span>
        <button
          onClick={() => setSheetOpen(true)}
          className="text-xs font-semibold text-[#031820] bg-[#22d3ee] hover:bg-[#06b6d4] rounded-lg px-3 py-2 transition-colors"
        >
          + New Lead Source
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-100">No Lead Sources yet</p>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
            Make one — sweep Google Maps for a category in a place (say, roofers near Knoxville with no
            website), or paste a list of URLs to visit. PA pulls the profiles, sorts them by fit, and
            stages the batch for you.
          </p>
          <button
            onClick={() => setSheetOpen(true)}
            className="mt-4 text-xs font-semibold text-[#031820] bg-[#22d3ee] hover:bg-[#06b6d4] rounded-lg px-3.5 py-2 transition-colors"
          >
            + New Lead Source
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((s) => (
            <SourceRow key={s.id} source={s} connected={connected} />
          ))}
        </div>
      )}

      {sheetOpen && (
        <NewSourceSheet
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
