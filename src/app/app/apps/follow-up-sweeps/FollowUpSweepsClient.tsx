"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SourceType = "gmail" | "brain_customer" | "lead_scout";
type Relationship = "cold_lead" | "active_customer" | "past_customer";

export type SourceView = {
  id: string;
  sourceType: SourceType;
  label: string;
  relationship: Relationship;
  dormancyDays: number;
  enabled: boolean;
  lastSweptAt: string | null;
};

type ContactView = {
  id: string;
  contact_email: string;
  contact_name: string | null;
  last_touched_at: string | null;
  suppressed: boolean;
  last_drafted_at: string | null;
};

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  gmail: "Gmail (sent mail)",
  brain_customer: "Brain customer files",
  lead_scout: "Lead Scout leads",
};

const SOURCE_TYPE_HELP: Record<SourceType, string> = {
  gmail: "People you emailed a while ago and haven't followed up with since.",
  brain_customer: "Customer files in your brain, dated by their most recent touch on file.",
  lead_scout: "Leads your Lead Scout found that have gone quiet since.",
};

const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  cold_lead: "Cold lead",
  active_customer: "Active customer",
  past_customer: "Past customer",
};

const RELATIONSHIP_DEFAULT_DAYS: Record<Relationship, number> = {
  cold_lead: 14,
  active_customer: 30,
  past_customer: 60,
};

const RELATIONSHIP_TONE: Record<Relationship, string> = {
  cold_lead: "Warm reactivation — a fresh reason to reply.",
  active_customer: "A genuine check-in — make sure they're taken care of.",
  past_customer: "A deeper reconnect — a concrete reason to come back.",
};

const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none";
const LABEL_CLASS = "text-[11px] font-mono text-slate-400 uppercase tracking-wider";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AddWatch({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("gmail");
  const [relationship, setRelationship] = useState<Relationship>("cold_lead");
  const [label, setLabel] = useState("");
  const [brainDir, setBrainDir] = useState("customers");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { sourceType, relationship, label: label.trim() };
    if (sourceType === "brain_customer" && brainDir.trim()) body.brainDir = brainDir.trim();

    const res = await fetch("/api/app/apps/followup-sweeps/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Couldn't create the watch.");
      return;
    }
    setLabel("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-4 py-2.5 text-sm font-semibold text-[#22d3ee] hover:bg-[#22d3ee]/10"
      >
        + Add a watch
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Where to watch</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className={FIELD_CLASS}
          >
            {(Object.keys(SOURCE_TYPE_LABEL) as SourceType[]).map((t) => (
              <option key={t} value={t}>
                {SOURCE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-400">{SOURCE_TYPE_HELP[sourceType]}</p>
        </div>
        <div>
          <label className={LABEL_CLASS}>Who these are</label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as Relationship)}
            className={FIELD_CLASS}
          >
            {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]} — quiet for {RELATIONSHIP_DEFAULT_DAYS[r]} days
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-400">{RELATIONSHIP_TONE[relationship]}</p>
        </div>
      </div>

      <div className="mt-4">
        <label className={LABEL_CLASS}>Name this watch</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Cold leads from the spring campaign"
          className={FIELD_CLASS}
        />
      </div>

      {sourceType === "brain_customer" && (
        <div className="mt-4">
          <label className={LABEL_CLASS}>Brain folder</label>
          <input
            value={brainDir}
            onChange={(e) => setBrainDir(e.target.value)}
            placeholder="customers"
            className={FIELD_CLASS}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            The folder in your brain that holds one file per customer.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !label.trim()}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          {busy ? "Adding…" : "Add watch"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SourceRow({ source, onChanged }: { source: SourceView; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactView[] | null>(null);

  async function sweepNow() {
    setBusy("sweep");
    setNote(null);
    const res = await fetch(`/api/app/apps/followup-sweeps/batches/${source.id}/generate`, {
      method: "POST",
    });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setNote(data.error || "Sweep failed.");
      return;
    }
    const data = (await res.json()) as { discovered: number; staged: number };
    setNote(
      data.staged > 0
        ? `Found ${data.discovered}, drafted ${data.staged} — staged in your Inbox for review.`
        : `Found ${data.discovered}. No new drafts — everyone's been contacted recently or left alone.`,
    );
    onChanged();
  }

  async function toggleEnabled() {
    setBusy("toggle");
    await fetch(`/api/app/apps/followup-sweeps/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    setBusy(null);
    onChanged();
  }

  async function remove() {
    setBusy("delete");
    await fetch(`/api/app/apps/followup-sweeps/sources/${source.id}`, { method: "DELETE" });
    setBusy(null);
    onChanged();
  }

  async function loadContacts() {
    if (contacts) {
      setContacts(null);
      return;
    }
    setBusy("contacts");
    const res = await fetch(`/api/app/apps/followup-sweeps/sources/${source.id}/contacts`);
    setBusy(null);
    if (!res.ok) return;
    const data = (await res.json()) as { contacts: ContactView[] };
    setContacts(data.contacts);
  }

  async function toggleSuppress(c: ContactView) {
    await fetch(`/api/app/apps/followup-sweeps/contacts/${c.id}/suppress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suppressed: !c.suppressed }),
    });
    setContacts((prev) =>
      prev ? prev.map((x) => (x.id === c.id ? { ...x, suppressed: !x.suppressed } : x)) : prev,
    );
  }

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{source.label}</h3>
            {!source.enabled && (
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono uppercase text-slate-500">
                Paused
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {SOURCE_TYPE_LABEL[source.sourceType]} · {RELATIONSHIP_LABEL[source.relationship]} · quiet
            for {source.dormancyDays} days · last swept {relativeTime(source.lastSweptAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={sweepNow}
          disabled={busy !== null}
          className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
        >
          {busy === "sweep" ? "Sweeping…" : "Sweep now"}
        </button>
        <button
          onClick={loadContacts}
          disabled={busy !== null}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
        >
          {contacts ? "Hide contacts" : "Contacts"}
        </button>
        <button
          onClick={toggleEnabled}
          disabled={busy !== null}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
        >
          {source.enabled ? "Pause" : "Resume"}
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-400 disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      {note && <p className="mt-3 text-xs text-[#22d3ee]">{note}</p>}

      {contacts && (
        <div className="mt-4 border-t border-slate-800/60 pt-3">
          {contacts.length === 0 ? (
            <p className="text-xs text-slate-500">
              No contacts yet — run a sweep to find who&apos;s gone quiet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className={c.suppressed ? "text-slate-600 line-through" : "text-slate-300"}>
                    {c.contact_name || c.contact_email}
                    <span className="ml-2 text-slate-600">
                      last touch {relativeTime(c.last_touched_at)}
                    </span>
                  </span>
                  <button
                    onClick={() => toggleSuppress(c)}
                    className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {c.suppressed ? "Bring back" : "Leave alone"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function FollowUpSweepsClient({
  sources,
  hasApiKey,
  hasBrain,
}: {
  sources: SourceView[];
  hasApiKey: boolean;
  hasBrain: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]/60">
            Runs weekly
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Follow-Up Sweeps</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            The follow-up you always mean to do and never have time for — run on a sweep. Point it at
            the contacts that go quiet: leads who ghosted, customers you haven&apos;t checked in on,
            past clients worth winning back. Every Sunday it finds the ones past due, drafts the next
            message in your voice, and stages the batch in your Inbox for one tap. Nothing sends until
            you say so, and anyone you mark <span className="text-slate-100">leave alone</span> stays
            off the list for good.
          </p>
        </div>

        {!hasApiKey && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4">
            <span className="mt-0.5 shrink-0 font-mono text-sm text-[#22d3ee]">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Add your Anthropic API key to draft follow-ups.
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Your key, your bill, your data.{" "}
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Go to Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <AddWatch onCreated={refresh} />
        </div>

        {sources.length === 0 ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-100">No watches yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Add your first watch above. A common start: a <em>Cold leads</em> watch on your Gmail
              sent mail, and an <em>Active customers</em> watch on your brain&apos;s customer files.
              {!hasBrain && " Connect a brain to watch customer files."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} onChanged={refresh} />
            ))}
          </div>
        )}

        <div className="mt-10 border-t border-slate-800/60 pt-6">
          <p className="text-sm leading-relaxed text-slate-500">
            Every draft stages in{" "}
            <Link href="/app/mission-control" className="text-slate-400 hover:text-[#22d3ee]">
              Mission Control
            </Link>{" "}
            — review, edit, and send on your tap. Pair this with{" "}
            <Link href="/app/apps/lead-scout" className="text-slate-400 hover:text-[#22d3ee]">
              Lead Scout
            </Link>{" "}
            to keep new leads flowing in while Follow-Up Sweeps keeps the old ones warm.
          </p>
        </div>
      </div>
    </div>
  );
}
