"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ConnectionStatus, DraftKind, EnrichmentSource } from "@/lib/linkedin-scout/types";

// ── View types (server → client) ────────────────────────────────────────────────────────────────

export type DraftView = {
  id: string;
  kind: DraftKind;
  body: string;
  voiceFlags: string;
  executedAt: string | null;
};

export type ProspectView = {
  id: string;
  linkedinProfileUrl: string;
  fullName: string;
  headline: string;
  company: string;
  fitScore: number;
  enrichmentSource: EnrichmentSource;
  brief: string;
  connectionStatus: ConnectionStatus;
  day3InmailStatus: string;
  day7FollowupStatus: string;
  drafts: DraftView[];
};

type RitualView = {
  id: string;
  name: string;
  scheduleText: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
};

// A candidate returned by the search route (before shortlisting).
type Candidate = {
  linkedinProfileUrl: string;
  fullName: string;
  headline: string;
  company: string;
  fitScore: number;
  enrichmentSource: EnrichmentSource;
  enrichmentSnapshot: Record<string, unknown>;
};

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none";
const LABEL_CLASS = "text-[11px] font-mono text-slate-400 uppercase tracking-wider";

const DRAFT_LABEL: Record<DraftKind, string> = {
  connection_note: "Connection note",
  day3_inmail: "Day-3 InMail",
  day7_followup: "Day-7 follow-up",
};

const STATUS_FILTERS: { value: ConnectionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Not sent" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
];

function fitBadge(score: number): { label: string; cls: string } {
  if (score >= 70) return { label: `${score} · strong`, cls: "bg-emerald-500/15 text-emerald-300" };
  if (score >= 40) return { label: `${score} · worth a look`, cls: "bg-amber-500/15 text-amber-300" };
  return { label: `${score} · weak`, cls: "bg-slate-600/20 text-slate-400" };
}

type Tab = "search" | "shortlist" | "prospects" | "rituals";

export default function LinkedInScoutClient({
  initialProspects,
  rituals,
  configuredSources,
  sourceLabels,
  weeklyCap,
  tierLabel,
}: {
  initialProspects: ProspectView[];
  rituals: RitualView[];
  configuredSources: EnrichmentSource[];
  sourceLabels: Record<EnrichmentSource, string>;
  weeklyCap: number | null;
  tierLabel: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialProspects.length > 0 ? "prospects" : "search");

  // Search state
  const [title, setTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [keywords, setKeywords] = useState("");
  const [freeText, setFreeText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Results / shortlist state
  const [runId, setRunId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shortlisting, setShortlisting] = useState(false);
  const [shortlistMsg, setShortlistMsg] = useState<string | null>(null);

  const noSources = configuredSources.length === 0;

  async function runSearch() {
    if (searching || noSources) return;
    setSearching(true);
    setSearchError(null);
    setShortlistMsg(null);
    try {
      const res = await fetch("/api/app/apps/linkedin-scout/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          seniority: seniority.trim() || undefined,
          companySize: companySize.trim() || undefined,
          location: location.trim() || undefined,
          industry: industry.trim() || undefined,
          keywords: keywords.trim() || undefined,
          freeText: freeText.trim() || undefined,
        }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        runId?: string;
        candidates?: Candidate[];
        noSourcesConfigured?: boolean;
      };
      if (!res.ok) {
        setSearchError(body.message ?? body.error ?? "Search failed.");
        return;
      }
      if (body.noSourcesConfigured) {
        setSearchError(body.message ?? "Connect an enrichment source to search.");
        return;
      }
      setRunId(body.runId ?? null);
      setCandidates(body.candidates ?? []);
      setSelected(new Set((body.candidates ?? []).map((c) => c.linkedinProfileUrl)));
      setTab("shortlist");
    } finally {
      setSearching(false);
    }
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function shortlist() {
    if (shortlisting || !runId) return;
    const chosen = candidates.filter((c) => selected.has(c.linkedinProfileUrl));
    if (chosen.length === 0) return;
    setShortlisting(true);
    setShortlistMsg(null);
    try {
      const res = await fetch("/api/app/apps/linkedin-scout/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          candidates: chosen.map((c) => ({
            linkedinProfileUrl: c.linkedinProfileUrl,
            fullName: c.fullName,
            headline: c.headline,
            company: c.company,
            fitScore: c.fitScore,
            enrichmentSource: c.enrichmentSource,
            enrichmentSnapshot: c.enrichmentSnapshot,
          })),
        }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        prospects?: number;
        cardsQueued?: number;
      };
      if (!res.ok) {
        setShortlistMsg(body.message ?? body.error ?? "Couldn't shortlist.");
        return;
      }
      setShortlistMsg(
        `Shortlisted ${body.prospects ?? 0} prospect${body.prospects === 1 ? "" : "s"} — ${body.cardsQueued ?? 0} outreach cards staged in your Approval Queue.`,
      );
      router.refresh();
      setTab("prospects");
    } finally {
      setShortlisting(false);
    }
  }

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} prospectCount={initialProspects.length} />

      {tab === "search" && (
        <SearchTab
          noSources={noSources}
          configuredSources={configuredSources}
          sourceLabels={sourceLabels}
          weeklyCap={weeklyCap}
          tierLabel={tierLabel}
          fields={{ title, seniority, companySize, location, industry, keywords, freeText }}
          setters={{ setTitle, setSeniority, setCompanySize, setLocation, setIndustry, setKeywords, setFreeText }}
          searching={searching}
          error={searchError}
          onRun={runSearch}
        />
      )}

      {tab === "shortlist" && (
        <ShortlistTab
          candidates={candidates}
          selected={selected}
          onToggle={toggle}
          onShortlist={shortlist}
          shortlisting={shortlisting}
          message={shortlistMsg}
          sourceLabels={sourceLabels}
        />
      )}

      {tab === "prospects" && (
        <ProspectsTab prospects={initialProspects} sourceLabels={sourceLabels} onChanged={() => router.refresh()} />
      )}

      {tab === "rituals" && <RitualsTab rituals={rituals} />}
    </div>
  );
}

function TabBar({
  tab,
  setTab,
  prospectCount,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  prospectCount: number;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "search", label: "Search" },
    { key: "shortlist", label: "Shortlist" },
    { key: "prospects", label: `Prospects${prospectCount ? ` (${prospectCount})` : ""}` },
    { key: "rituals", label: "Rituals" },
  ];
  return (
    <div className="mb-5 flex gap-1 border-b border-slate-800">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === t.key
              ? "border-[#22d3ee] text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SearchTab({
  noSources,
  configuredSources,
  sourceLabels,
  weeklyCap,
  tierLabel,
  fields,
  setters,
  searching,
  error,
  onRun,
}: {
  noSources: boolean;
  configuredSources: EnrichmentSource[];
  sourceLabels: Record<EnrichmentSource, string>;
  weeklyCap: number | null;
  tierLabel: string;
  fields: Record<string, string>;
  setters: Record<string, (v: string) => void>;
  searching: boolean;
  error: string | null;
  onRun: () => void;
}) {
  if (noSources) {
    return (
      <div className="rounded-xl border border-amber-700/40 bg-amber-500/5 p-6">
        <h2 className="text-sm font-semibold text-amber-200">Connect an enrichment source</h2>
        <p className="mt-2 text-sm text-slate-300">
          LinkedIn Scout reads prospects through the paid data you already pay for — Apollo, Clay, or
          Common Room — and never scrapes LinkedIn. Connect one to run a search.
        </p>
        <Link
          href="/app/settings/connections"
          className="mt-4 inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          Go to Connections
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Searching via</span>
        {configuredSources.map((s) => (
          <span key={s} className="rounded-full bg-slate-800 px-2.5 py-1 font-mono text-[11px] text-slate-200">
            {sourceLabels[s]}
          </span>
        ))}
        {weeklyCap !== null && (
          <span className="ml-auto text-[11px] text-slate-500">
            {tierLabel}: up to {weeklyCap} shortlisted / rolling 7 days
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Role / title" value={fields.title} onChange={setters.setTitle} placeholder="VP of Marketing" />
        <Field label="Seniority" value={fields.seniority} onChange={setters.setSeniority} placeholder="Director, VP, C-level" />
        <Field label="Company size" value={fields.companySize} onChange={setters.setCompanySize} placeholder="11-50, 51-200" />
        <Field label="Location" value={fields.location} onChange={setters.setLocation} placeholder="Austin, TX" />
        <Field label="Industry" value={fields.industry} onChange={setters.setIndustry} placeholder="SaaS, construction" />
        <Field label="Keywords" value={fields.keywords} onChange={setters.setKeywords} placeholder="RevOps, HubSpot" />
      </div>

      <div className="mt-4">
        <label className={LABEL_CLASS}>Or describe your ideal customer (free-text)</label>
        <textarea
          className={FIELD_CLASS}
          rows={3}
          value={fields.freeText}
          onChange={(e) => setters.setFreeText(e.target.value)}
          placeholder="Heads of sales at 20-100 person B2B software companies who post about outbound and just changed jobs."
        />
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <button
        onClick={onRun}
        disabled={searching}
        className="mt-5 inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-[#67e8f9] disabled:opacity-50"
      >
        {searching ? "Searching…" : "Run search"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input className={FIELD_CLASS} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ShortlistTab({
  candidates,
  selected,
  onToggle,
  onShortlist,
  shortlisting,
  message,
  sourceLabels,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggle: (url: string) => void;
  onShortlist: () => void;
  shortlisting: boolean;
  message: string | null;
  sourceLabels: Record<EnrichmentSource, string>;
}) {
  if (candidates.length === 0) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        Run a search first — the fit-scored candidates land here to shortlist.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {selected.size} of {candidates.length} selected
        </p>
        <button
          onClick={onShortlist}
          disabled={shortlisting || selected.size === 0}
          className="inline-flex items-center rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#67e8f9] disabled:opacity-50"
        >
          {shortlisting ? "Researching + drafting…" : "Shortlist selected"}
        </button>
      </div>
      {message && <p className="mb-4 text-sm text-emerald-300">{message}</p>}
      <ul className="space-y-2">
        {candidates.map((c) => {
          const badge = fitBadge(c.fitScore);
          const isSel = selected.has(c.linkedinProfileUrl);
          return (
            <li
              key={c.linkedinProfileUrl}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                isSel ? "border-[#22d3ee]/40 bg-slate-900/70" : "border-slate-800 bg-slate-900/30"
              }`}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => onToggle(c.linkedinProfileUrl)}
                className="mt-1 h-4 w-4 accent-[#22d3ee]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">{c.fullName || "(name unknown)"}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-mono ${badge.cls}`}>{badge.label}</span>
                </div>
                <p className="truncate text-xs text-slate-400">
                  {c.headline}
                  {c.company ? ` · ${c.company}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {sourceLabels[c.enrichmentSource]} ·{" "}
                  <a href={c.linkedinProfileUrl} target="_blank" rel="noreferrer" className="hover:text-slate-300 underline">
                    profile
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProspectsTab({
  prospects,
  sourceLabels,
  onChanged,
}: {
  prospects: ProspectView[];
  sourceLabels: Record<EnrichmentSource, string>;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<ConnectionStatus | "all">("all");
  const shown = filter === "all" ? prospects : prospects.filter((p) => p.connectionStatus === filter);

  if (prospects.length === 0) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        No prospects yet. Run a search, shortlist a few, and PA researches each and drafts the outreach.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f.value ? "bg-slate-700 text-slate-100" : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {shown.map((p) => (
          <ProspectRow key={p.id} prospect={p} sourceLabels={sourceLabels} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}

function ProspectRow({
  prospect,
  sourceLabels,
  onChanged,
}: {
  prospect: ProspectView;
  sourceLabels: Record<EnrichmentSource, string>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyKind, setBusyKind] = useState<DraftKind | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const badge = fitBadge(prospect.fitScore);

  async function execute(kind: DraftKind) {
    if (busyKind) return;
    setBusyKind(kind);
    setNote(null);
    try {
      const res = await fetch(`/api/app/apps/linkedin-scout/prospects/${prospect.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; status?: string };
      setNote(res.ok ? body.message ?? "Queued." : body.error ?? "Couldn't queue the send.");
      if (res.ok) onChanged();
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/30">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100">{prospect.fullName || "(name unknown)"}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-mono ${badge.cls}`}>{badge.label}</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">{prospect.connectionStatus}</span>
          </div>
          <p className="truncate text-xs text-slate-400">
            {prospect.headline}
            {prospect.company ? ` · ${prospect.company}` : ""}
          </p>
        </div>
        <span className="text-xs text-slate-500">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 p-3">
          {prospect.brief && (
            <div className="mb-3">
              <p className={LABEL_CLASS}>Brief</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-300">{prospect.brief}</p>
            </div>
          )}
          <p className="mb-1 text-[11px] text-slate-500">
            {sourceLabels[prospect.enrichmentSource]} ·{" "}
            <a href={prospect.linkedinProfileUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
              open profile
            </a>
          </p>
          <div className="space-y-2">
            {prospect.drafts.length === 0 && <p className="text-sm text-slate-500">No drafts staged.</p>}
            {prospect.drafts.map((d) => (
              <div key={d.id} className="rounded border border-slate-800 bg-slate-950/60 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">{DRAFT_LABEL[d.kind]}</span>
                  {d.executedAt ? (
                    <span className="text-[11px] text-emerald-400">queued</span>
                  ) : (
                    <button
                      onClick={() => execute(d.kind)}
                      disabled={busyKind !== null}
                      className="rounded bg-slate-800 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                    >
                      {busyKind === d.kind ? "Queuing…" : "Approve & queue send"}
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-300">{d.body}</p>
                {d.voiceFlags && <p className="mt-1 text-[11px] text-amber-400">⚠️ {d.voiceFlags}</p>}
              </div>
            ))}
          </div>
          {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
        </div>
      )}
    </li>
  );
}

function RitualsTab({ rituals }: { rituals: RitualView[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Follow-up rituals</h2>
        <Link href="/app/apps/rituals" className="text-xs text-[#22d3ee] hover:text-[#67e8f9]">
          Manage in Ritual Scheduler →
        </Link>
      </div>
      {rituals.length === 0 ? (
        <p className="text-sm text-slate-400">
          No LinkedIn Scout rituals yet. Install the Day-3 and Day-7 follow-up rituals from the Ritual
          Scheduler and the follow-up cards stage themselves on schedule.
        </p>
      ) : (
        <ul className="space-y-2">
          {rituals.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <p className="text-sm text-slate-100">{r.name}</p>
                <p className="text-xs text-slate-500">{r.scheduleText}</p>
              </div>
              <span className={`text-[11px] ${r.enabled ? "text-emerald-400" : "text-slate-500"}`}>
                {r.enabled ? "active" : "paused"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
