"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TabGuide } from "../_components/TabGuide";

// SkillsClient — the owner-facing Skills tab (Skills SPEC §9.1). Lists the techniques the agent
// has accumulated, surfaces LEARN-phase proposals waiting for an OK, lets the owner hand-seed a
// skill, and opens a detail view with version history (roll-back), the triggered-run log, and the
// per-skill auto-evolve toggle. Copy is plain English — these are buyers, not engineers.

type SkillSummary = {
  slug: string;
  name: string;
  description: string;
  whenToUse: string;
  zone: string;
  version: number;
  successCount: number;
  ownerApprovalsCount: number;
  lastEvolvedAt: string;
  createdAt: string;
  autoEvolve: boolean;
};

type ProposalSummary = {
  inboxItemId: string;
  action: "new" | "update";
  slug: string;
  name: string;
  reason: string;
  createdAt: string;
};

type TriggeredRecord = { path: string; date: string; summary: string };

type SkillDetail = {
  frontmatter: {
    name: string;
    description: string;
    whenToUse: string;
    prerequisites: string[];
    zone: string;
    evolution: {
      version: number;
      successCount: number;
      ownerApprovalsCount: number;
      lastEvolvedAt: string;
      createdAt: string;
      autoEvolve: boolean;
    };
  };
  body: string;
  versions: number[];
  triggered: TriggeredRecord[];
};

const CHIPS = ["Drafting", "Research", "Outreach", "Follow-up", "Data entry", "Quote / proposal"];

const EXAMPLE_BODY = `1. Read the inspection photos for scope, not damage. The adjuster already agreed there's
   damage — find the items the original estimate missed: drip edge, ice-and-water in the
   valleys, ridge vent, a second layer of decking.
2. Pull the storm date from NOAA to anchor the supplement to a covered event. If nothing
   matches, flag it before anything gets filed.
3. Structure the line items the way carriers approve: scope → quantity → unit price →
   depreciation line. The depreciation line is the one that gets missed and the one that
   gets supplements rejected. It goes on every line.
4. Write the cover email in your voice. One-line greet, the supplement is attached, the one
   scope item that matters named specifically, single ask. No "I hope this finds you well."
5. Stage everything for approval. Nothing gets filed until you say go.`;

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "";
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error ?? `Request failed (${res.status})` };
}

export default function SkillsClient({ hasBrain }: { hasBrain: boolean }) {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/skills", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        skills?: SkillSummary[];
        proposals?: ProposalSummary[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Couldn't load your skills.");
        setSkills([]);
        setProposals([]);
      } else {
        setSkills(data.skills ?? []);
        setProposals(data.proposals ?? []);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasBrain) void load();
    else setLoading(false);
  }, [hasBrain, load]);

  return (
    <div className="min-h-screen bg-[#070c11] text-slate-200">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 lg:py-14 flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-slate-100">Skills</h1>
          <p className="text-[15px] text-slate-400 leading-relaxed">
            Skills are the moves your agent has learned. Every time it finishes something the right
            way — and you approve it — it can save the technique here and start the next job from
            that, instead of from scratch. Apps are what Pocket Agent can do out of the box; Skills
            are what it&apos;s picked up from working with <em>you</em>.
          </p>
        </header>

        {!hasBrain && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <p className="text-sm text-amber-200/90 leading-relaxed">
              Connect your brain to start saving Skills — they live in your own files, so they keep
              working even if you cancel.
            </p>
            <Link
              href="/app/settings/connections"
              className="mt-2 inline-block text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee]"
            >
              Connect your brain →
            </Link>
          </div>
        )}

        {proposals.length > 0 && (
          <ProposalList proposals={proposals} onChanged={load} />
        )}

        {hasBrain && <CreateSkill onCreated={load} />}

        {loading ? (
          <p className="text-sm text-slate-500">Loading your skills…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : skills.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {skills.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSelected(s.slug)}
                className="text-left rounded-2xl border border-slate-800/70 bg-slate-900/40 px-5 py-4 hover:border-slate-700 hover:bg-slate-900/70 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-slate-100">{s.name}</p>
                  {s.autoEvolve && (
                    <span className="shrink-0 text-[10px] font-mono text-[#22d3ee]/80 border border-[#22d3ee]/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
                      auto-evolve
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{s.description}</p>
                )}
                <p className="mt-2 text-[11px] font-mono text-slate-600">
                  v{s.version}
                  {s.successCount > 0 && ` · used ${s.successCount}×`}
                  {s.lastEvolvedAt && ` · evolved ${relativeTime(s.lastEvolvedAt)}`}
                </p>
              </button>
            ))}
          </div>
        )}

        <StarterPack />

        <TabGuide
          promptsHeading="Try one of these"
          prompts={[
            "Draft a follow-up to the lead we met last week",
            "Write a proposal for the kitchen remodel we scoped",
            "Put together my Monday morning brief",
          ]}
          worksWith={[
            { href: "/app/apps", label: "Apps", blurb: "The workflows PA ships out of the box — Skills are the moves it learns on top." },
            { href: "/app/personas", label: "Personas", blurb: "A persona is the character; a Skill is one of the moves that character makes." },
            { href: "/app/mission-control", label: "Mission Control", blurb: "When PA wants to save or sharpen a Skill, it asks you here first." },
          ]}
          exampleLabel="See an example skill"
          exampleNote="A real skill is one markdown file in your brain — readable, editable, and yours to roll back or delete."
        >
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <p className="text-[15px] font-semibold text-slate-100">Draft Roof Supplement Quote</p>
            <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
              Turn inspection photos and a storm date into an insurance-approved supplement quote,
              structured the way carriers approve, in your voice.
            </p>
            <p className="mt-2 text-[11px] font-mono text-slate-600">v4 · used 9× · evolved 2d ago</p>
            <pre className="mt-3 text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {EXAMPLE_BODY}
            </pre>
          </div>
        </TabGuide>
      </div>

      {selected && (
        <SkillDetailDrawer
          slug={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ── Starter Pack (PA-STARTERSKILL-5) ─────────────────────────────────────────────────────────
// The 30 starter Skills the AI Office Launch Kit comes with, grouped by category. Each shows whether
// the owner's plan has it unlocked, a View that renders the full technique, and a per-skill Disable
// toggle (a disabled skill stops loading into runs without deleting the brain file).

type StarterSkill = {
  slug: string;
  name: string;
  description: string;
  whenToUse: string;
  tierRequired: string;
  tierLabel: string;
  unlocked: boolean;
  disabled: boolean;
  body: string;
};
type StarterGroup = { category: string; label: string; skills: StarterSkill[] };

function StarterPack() {
  const [groups, setGroups] = useState<StarterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app/skills/starter", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { groups?: StarterGroup[]; error?: string };
      if (!res.ok) setError(data.error ?? "Couldn't load the starter pack.");
      else setGroups(data.groups ?? []);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDisabled(s: StarterSkill) {
    setBusy(s.slug);
    const res = await postJson(`/api/app/skills/starter/${encodeURIComponent(s.slug)}/disable`, {
      disabled: !s.disabled,
    });
    setBusy(null);
    if (res.ok) {
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          skills: g.skills.map((x) => (x.slug === s.slug ? { ...x, disabled: !x.disabled } : x)),
        })),
      );
    } else {
      setError(res.error ?? "Couldn't change that setting.");
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading the starter pack…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="text-[11px] font-mono text-[#22d3ee]/70 tracking-[0.14em] uppercase font-semibold">
          Starter Pack
        </span>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          The moves your AI Office Launch Kit comes with — 30 techniques, ready to load into your
          agent&apos;s work. The ones your plan unlocks get copied into your brain, so you can read,
          edit, or roll them back like any other skill.
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.category} className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-slate-300">{g.label}</p>
          <div className="flex flex-col gap-2">
            {g.skills.map((s) => (
              <div
                key={s.slug}
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold text-slate-100">{s.name}</p>
                  {s.unlocked ? (
                    <span className="shrink-0 text-[10px] font-mono text-emerald-300/80 border border-emerald-400/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
                      Unlocked
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-mono text-amber-300/80 border border-amber-400/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
                      {s.tierLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-slate-400 leading-relaxed">{s.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setOpenSlug(openSlug === s.slug ? null : s.slug)}
                    className="text-[12px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
                  >
                    {openSlug === s.slug ? "Hide" : "View"}
                  </button>
                  {!s.unlocked && (
                    <Link
                      href="/pricing"
                      className="text-[12px] font-mono text-amber-300/70 hover:text-amber-200 transition-colors"
                    >
                      Upgrade to {s.tierLabel} →
                    </Link>
                  )}
                  {s.unlocked && (
                    <button
                      onClick={() => void toggleDisabled(s)}
                      disabled={busy === s.slug}
                      className={`ml-auto text-[12px] font-mono transition-colors disabled:opacity-50 ${
                        s.disabled
                          ? "text-slate-500 hover:text-emerald-300"
                          : "text-slate-500 hover:text-red-300"
                      }`}
                    >
                      {busy === s.slug ? "…" : s.disabled ? "Disabled · turn on" : "Disable"}
                    </button>
                  )}
                </div>
                {openSlug === s.slug && (
                  <div className="mt-3 border-t border-slate-800/60 pt-3">
                    {s.whenToUse && (
                      <p className="text-[12px] text-slate-500 leading-relaxed mb-2">
                        <span className="font-mono uppercase tracking-wider text-slate-600">When: </span>
                        {s.whenToUse}
                      </p>
                    )}
                    <pre className="text-[12.5px] text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {s.body}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 px-6 py-8 text-center">
      <p className="text-sm text-slate-300 leading-relaxed">
        No skills yet. As your agent finishes work and you approve it, it&apos;ll start asking to
        remember the moves that worked — and they&apos;ll show up here. You can also seed one by hand
        above.
      </p>
    </div>
  );
}

function ProposalList({
  proposals,
  onChanged,
}: {
  proposals: ProposalSummary[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(p: ProposalSummary, kind: "approve" | "reject") {
    setBusy(`${p.inboxItemId}:${kind}`);
    setErr(null);
    const res = await postJson(`/api/app/skills/proposals/${p.inboxItemId}/${kind}`);
    setBusy(null);
    if (!res.ok) {
      setErr(res.error ?? "Something went wrong");
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-mono text-violet-300/70 tracking-[0.14em] uppercase font-semibold">
        Waiting for your OK
      </span>
      {err && <p className="text-xs text-red-400 font-mono">{err}</p>}
      {proposals.map((p) => (
        <div
          key={p.inboxItemId}
          className="rounded-2xl border border-violet-500/20 bg-slate-900/50 px-5 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-semibold text-slate-100">{p.name}</p>
            <span className="shrink-0 text-[10px] font-mono text-violet-300/70 uppercase tracking-wider">
              {p.action === "update" ? "sharpen" : "new"}
            </span>
          </div>
          {p.reason && <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{p.reason}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void decide(p, "approve")}
              disabled={busy !== null}
              className="min-h-[40px] rounded-xl bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50 transition-colors"
            >
              {busy === `${p.inboxItemId}:approve` ? "Saving…" : "Approve & save"}
            </button>
            <Link
              href="/app/mission-control"
              className="min-h-[40px] flex items-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Read it first →
            </Link>
            <button
              onClick={() => void decide(p, "reject")}
              disabled={busy !== null}
              className="min-h-[40px] rounded-xl border border-slate-700/60 px-4 text-sm text-slate-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 transition-colors ml-auto"
            >
              {busy === `${p.inboxItemId}:reject` ? "…" : "Reject"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateSkill({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [whenToUse, setWhenToUse] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !body.trim()) {
      setErr("A skill needs at least a name and the steps.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await postJson("/api/app/skills", {
      name: name.trim(),
      description: description.trim(),
      whenToUse: whenToUse.trim(),
      body: body.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "Couldn't save the skill.");
      return;
    }
    setName("");
    setDescription("");
    setWhenToUse("");
    setBody("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="min-h-[40px] rounded-xl border border-slate-700/60 px-4 text-sm text-slate-200 hover:border-[#22d3ee]/40 hover:text-[#22d3ee] transition-colors"
        >
          + Create a skill manually
        </button>
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setName(`${c}: `);
              setOpen(true);
            }}
            className="min-h-[40px] rounded-full border border-slate-800/70 px-3 text-[13px] text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
          >
            {c}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-5 py-5 flex flex-col gap-3">
      <p className="text-sm font-semibold text-slate-200">Seed a skill by hand</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name — e.g. Draft a roof supplement quote"
        className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/40 focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="One line: what it's for (this is how the agent finds it)"
        className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/40 focus:outline-none"
      />
      <input
        value={whenToUse}
        onChange={(e) => setWhenToUse(e.target.value)}
        placeholder="When to use it — and when not to"
        className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/40 focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="The steps — the actual move, written the way you'd explain it to a new hire."
        rows={6}
        className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee]/40 focus:outline-none leading-relaxed"
      />
      {err && <p className="text-xs text-red-400 font-mono">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="min-h-[40px] rounded-xl bg-[#22d3ee]/15 border border-[#22d3ee]/40 px-4 text-sm font-medium text-[#22d3ee] hover:bg-[#22d3ee]/25 disabled:opacity-50 transition-colors"
        >
          {busy ? "Saving…" : "Save skill"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="min-h-[40px] px-4 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SkillDetailDrawer({
  slug,
  onClose,
  onChanged,
}: {
  slug: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/app/skills/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as Partial<SkillDetail> & { error?: string };
    setLoading(false);
    if (!res.ok || !data.frontmatter) {
      setError(data.error ?? "Couldn't load this skill.");
      return;
    }
    setDetail(data as SkillDetail);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rollback(version: number) {
    setBusy(`rollback:${version}`);
    const res = await postJson(`/api/app/skills/${encodeURIComponent(slug)}/rollback`, { version });
    setBusy(null);
    if (res.ok) {
      void load();
      onChanged();
    } else {
      setError(res.error ?? "Roll-back failed.");
    }
  }

  async function toggleAutoEvolve(enabled: boolean) {
    setBusy("auto-evolve");
    const res = await postJson(`/api/app/skills/${encodeURIComponent(slug)}/auto-evolve`, { enabled });
    setBusy(null);
    if (res.ok) {
      void load();
      onChanged();
    } else {
      setError(res.error ?? "Couldn't change that setting.");
    }
  }

  async function remove() {
    setBusy("delete");
    const res = await fetch(`/api/app/skills/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    setBusy(null);
    if (res.ok) {
      onChanged();
      onClose();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't delete this skill.");
    }
  }

  const ev = detail?.frontmatter.evolution;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative w-full max-w-xl h-full overflow-y-auto bg-[#0a1118] border-l border-slate-800/70 px-6 py-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-500 hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error && !detail ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : detail ? (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">{detail.frontmatter.name}</h2>
              {detail.frontmatter.description && (
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                  {detail.frontmatter.description}
                </p>
              )}
              {ev && (
                <p className="mt-2 text-[11px] font-mono text-slate-600">
                  v{ev.version}
                  {ev.successCount > 0 && ` · used ${ev.successCount}×`}
                  {` · ${ev.ownerApprovalsCount} approvals`}
                  {` · in your ${detail.frontmatter.zone} zone`}
                </p>
              )}
            </div>

            {detail.frontmatter.whenToUse && (
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  When to use it
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">{detail.frontmatter.whenToUse}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                The technique
              </p>
              <pre className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {detail.body}
              </pre>
            </div>

            {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">Let PA sharpen this on its own</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                    Once you&apos;ve approved a few updates, PA can refine this skill without asking
                    each time — and you can still roll it back.
                  </p>
                </div>
                <button
                  onClick={() => void toggleAutoEvolve(!ev?.autoEvolve)}
                  disabled={busy === "auto-evolve"}
                  className={`shrink-0 min-h-[36px] rounded-full px-4 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    ev?.autoEvolve
                      ? "bg-[#22d3ee]/15 border border-[#22d3ee]/40 text-[#22d3ee]"
                      : "border border-slate-700/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {ev?.autoEvolve ? "On" : "Off"}
                </button>
              </div>
            </div>

            {detail.versions.length > 1 && (
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Version history
                </p>
                <div className="flex flex-col gap-1.5">
                  {detail.versions.map((v) => (
                    <div
                      key={v}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/60 px-3 py-2"
                    >
                      <span className="text-sm text-slate-300">
                        v{v}
                        {ev && v === ev.version && (
                          <span className="ml-2 text-[10px] font-mono text-[#22d3ee]/80 uppercase">current</span>
                        )}
                      </span>
                      {ev && v !== ev.version && (
                        <button
                          onClick={() => void rollback(v)}
                          disabled={busy !== null}
                          className="text-[12px] font-mono text-slate-400 hover:text-[#22d3ee] disabled:opacity-50 transition-colors"
                        >
                          {busy === `rollback:${v}` ? "…" : "Roll back to this →"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.triggered.length > 0 && (
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Where it&apos;s been used
                </p>
                <div className="flex flex-col gap-1.5">
                  {detail.triggered.map((t) => (
                    <div key={t.path} className="rounded-lg border border-slate-800/60 px-3 py-2">
                      <p className="text-[12px] text-slate-400">
                        <span className="font-mono text-slate-600">{t.date}</span> — {t.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => void remove()}
                disabled={busy !== null}
                className="text-[13px] text-slate-500 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                {busy === "delete" ? "Deleting…" : "Delete this skill"}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
