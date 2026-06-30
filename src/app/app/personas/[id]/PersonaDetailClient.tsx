"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PERSONA_SECTIONS } from "@/lib/personas/spec";
import {
  PERSONA_MODE_LABELS,
  PERSONA_MODES,
  personaApps,
  type PersonaMode,
  type PersonaRow,
  type PersonaStatus,
} from "@/lib/personas/types";
import { APP_CATALOG, appsByIds } from "@/lib/apps/catalog";
import { getTemplate } from "@/lib/personas/templates";

type SpecPayload = { id: string; version: number; fields: Record<string, string>; createdAt: string };
type SeatView = {
  id: string;
  invited_email: string;
  role: string;
  accepted_at: string | null;
  revoked_at: string | null;
  inviteUrl: string | null;
};
type Bundle = {
  persona: PersonaRow;
  spec: SpecPayload | null;
  seats: SeatView[];
  usage: { messagesThisMonth: number; messageCap: number | null; capReached: boolean };
  tier: string;
  publicModesEnabled: boolean;
  publicLink: string | null;
};

const TABS = ["Overview", "Spec", "Knowledge", "Apps", "Team", "Conversations", "Leads", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function PersonaDetailClient({ personaId }: { personaId: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/personas/${personaId}`);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to load");
      return;
    }
    setBundle((await res.json()) as Bundle);
  }, [personaId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) {
    return <div className="p-8 text-red-300 text-sm">{error}</div>;
  }
  if (!bundle) {
    return <div className="p-8 text-slate-500 text-sm">Loading…</div>;
  }

  const { persona } = bundle;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <Link href="/app/personas" className="text-sm text-slate-500 hover:text-slate-300">
          ← Personas
        </Link>
        <h1 className="text-2xl font-semibold text-slate-100 mt-2">{persona.name}</h1>
        <p className="text-sm text-slate-500">
          {persona.template_key} · {persona.status} · {bundle.tier}
        </p>

        <nav className="flex gap-1 mt-6 border-b border-slate-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-[#22d3ee] text-slate-100"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="py-6">
          {tab === "Overview" && <OverviewTab personaId={personaId} bundle={bundle} />}
          {tab === "Spec" && <SpecTab personaId={personaId} bundle={bundle} onChange={reload} />}
          {tab === "Knowledge" && <KnowledgeTab personaId={personaId} />}
          {tab === "Apps" && <AppsTab personaId={personaId} bundle={bundle} onChange={reload} />}
          {tab === "Team" && <TeamTab personaId={personaId} seats={bundle.seats} onChange={reload} />}
          {tab === "Conversations" && <ConversationsTab personaId={personaId} />}
          {tab === "Leads" && <LeadsTab personaId={personaId} />}
          {tab === "Settings" && (
            <SettingsTab personaId={personaId} bundle={bundle} onChange={reload} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────────────
function OverviewTab({ personaId, bundle }: { personaId: string; bundle: Bundle }) {
  const [copied, setCopied] = useState(false);
  const { usage, seats } = bundle;
  const pending = seats.filter((s) => !s.accepted_at && !s.revoked_at).length;

  async function copyLink() {
    const res = await fetch(`/api/personas/${personaId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json().catch(() => ({}))) as { chatUrl?: string };
    if (body.chatUrl) {
      await navigator.clipboard.writeText(body.chatUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Messages this month" value={String(usage.messagesThisMonth)} />
        <Stat
          label="Monthly cap"
          value={usage.messageCap === null ? "Unlimited" : String(usage.messageCap)}
        />
        <Stat label="Seats" value={`${seats.filter((s) => !s.revoked_at).length}`} sub={`${pending} pending`} />
      </div>
      {usage.capReached && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          This persona has reached its monthly message limit. Upgrade to Studio to lift the cap.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copyLink}
          className="rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
        >
          {copied ? "Share link copied!" : "Copy share link"}
        </button>
        <Link
          href={`/app/personas/${personaId}/memory`}
          className="rounded-lg border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2.5 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          What it remembers about you →
        </Link>
        <Link
          href={`/app/personas/${personaId}/soul`}
          className="rounded-lg border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2.5 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          How it works with you →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Spec ──────────────────────────────────────────────────────────────────────────────
function SpecTab({
  personaId,
  bundle,
  onChange,
}: {
  personaId: string;
  bundle: Bundle;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(bundle.spec?.fields ?? {});
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<SpecPayload[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/personas/${personaId}/spec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setEditing(false);
    setMsg("Saved as new version.");
    onChange();
  }

  async function toggleVersions() {
    if (versions) {
      setVersions(null);
      return;
    }
    const res = await fetch(`/api/personas/${personaId}/spec`);
    if (res.ok) {
      const body = (await res.json()) as { versions: SpecPayload[] };
      setVersions(body.versions);
    }
  }

  async function refreshVersions() {
    const res = await fetch(`/api/personas/${personaId}/spec`);
    if (res.ok) {
      const body = (await res.json()) as { versions: SpecPayload[] };
      setVersions(body.versions);
    }
  }

  async function rollback(specId: string) {
    const res = await fetch(`/api/personas/${personaId}/spec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specId }),
    });
    if (res.ok) {
      setMsg("Rolled back.");
      onChange();
      refreshVersions();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          The persona&apos;s behavior contract {bundle.spec ? `(v${bundle.spec.version})` : ""}.
        </p>
        <div className="flex gap-2">
          <button
            onClick={toggleVersions}
            className="text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800"
          >
            Versions
          </button>
          {!editing ? (
            <button
              onClick={() => {
                setFields(bundle.spec?.fields ?? {});
                setEditing(true);
              }}
              className="text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="text-xs rounded-md bg-[#22d3ee] text-[#06222a] font-semibold px-3 py-1.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save version"}
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-xs text-[#22d3ee]">{msg}</p>}

      {versions && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-slate-300">
                v{v.version}
                {bundle.spec?.id === v.id && <span className="text-[#22d3ee] ml-2">current</span>}
              </span>
              {bundle.spec?.id !== v.id && (
                <button
                  onClick={() => rollback(v.id)}
                  className="text-xs text-slate-400 hover:text-[#22d3ee]"
                >
                  Roll back to this
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {PERSONA_SECTIONS.map((s) => (
          <div key={s.key}>
            <h3 className="text-sm font-medium text-slate-200">{s.heading}</h3>
            {editing ? (
              <textarea
                value={fields[s.key] ?? ""}
                onChange={(e) => setFields((f) => ({ ...f, [s.key]: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#22d3ee]"
              />
            ) : (
              <p className="text-sm text-slate-400 whitespace-pre-wrap mt-1">
                {bundle.spec?.fields[s.key]?.trim() || "—"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Knowledge ──────────────────────────────────────────────────────────────────────────
type KFile = { name: string; path: string; sizeBytes: number };
function KnowledgeTab({ personaId }: { personaId: string }) {
  const [files, setFiles] = useState<KFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/personas/${personaId}/knowledge`);
    if (res.ok) setFiles(((await res.json()) as { files: KFile[] }).files);
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/personas/${personaId}/knowledge`, { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error ?? "Upload failed");
    else load();
  }

  async function remove(name: string) {
    const res = await fetch(`/api/personas/${personaId}/knowledge`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name }),
    });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <label className="block rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-center cursor-pointer hover:border-slate-600">
        <input
          type="file"
          className="hidden"
          accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.currentTarget.value = "";
          }}
        />
        <span className="text-sm text-slate-300">{busy ? "Uploading…" : "Add a knowledge file"}</span>
      </label>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {files && files.length === 0 && <p className="text-sm text-slate-500">No knowledge files yet.</p>}
      <ul className="space-y-1.5">
        {files?.map((f) => (
          <li
            key={f.path}
            className="flex items-center justify-between text-sm bg-slate-900/60 rounded-lg px-3 py-2"
          >
            <span className="text-slate-300 truncate">{f.name}</span>
            <span className="flex items-center gap-3 ml-3 shrink-0">
              <span className="text-xs text-slate-500">{(f.sizeBytes / 1024).toFixed(1)} KB</span>
              <button onClick={() => remove(f.name)} className="text-xs text-slate-500 hover:text-red-400">
                remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Apps (the WHAT this persona uses) ───────────────────────────────────────────────────
function AppsTab({
  personaId,
  bundle,
  onChange,
}: {
  personaId: string;
  bundle: Bundle;
  onChange: () => void;
}) {
  const { persona } = bundle;
  const [sel, setSel] = useState<string[]>(personaApps(persona));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const template = getTemplate(persona.template_key);

  function toggle(id: string) {
    setMsg(null);
    setSel((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : [...cur, id]));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessibleApps: sel }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setMsg("Saved.");
    onChange();
  }

  const saved = personaApps(persona);
  const dirty =
    sel.length !== saved.length || sel.some((id) => !saved.includes(id));
  const chosen = appsByIds(sel);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
          This persona is the <span className="text-slate-100">who</span>. Apps are the{" "}
          <span className="text-slate-100">what</span> it uses — the workflows it&apos;s set up to run.
          Pick the ones it should reach.{" "}
          <Link href="/app/apps" className="text-[#22d3ee] hover:underline">
            Browse all Apps →
          </Link>
        </p>
      </div>

      {chosen.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {chosen.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 hover:border-[#22d3ee]/50 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-100">{a.label}</span>
                <span className="text-[11px] text-[#22d3ee]/50 group-hover:text-[#22d3ee] font-mono">
                  Open →
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{a.blurb}</p>
            </Link>
          ))}
        </div>
      )}

      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Choose Apps
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {APP_CATALOG.map((a) => {
            const on = sel.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  on
                    ? "border-[#22d3ee] bg-[#22d3ee]/5"
                    : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200">{a.label}</span>
                  <span className={`shrink-0 text-[15px] leading-none ${on ? "text-[#22d3ee]" : "text-slate-600"}`} aria-hidden>
                    {on ? "✓" : "+"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="text-xs rounded-md bg-[#22d3ee] text-[#06222a] font-semibold px-3 py-1.5 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Apps"}
        </button>
        {msg && <span className="text-xs text-[#22d3ee]">{msg}</span>}
      </div>

      {template && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4">
          <div className="text-[11px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.16em]">
            Try this with {persona.name}
          </div>
          <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
            &ldquo;{template.starterPrompt}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

// ── Team ──────────────────────────────────────────────────────────────────────────────
function TeamTab({
  personaId,
  seats,
  onChange,
}: {
  personaId: string;
  seats: SeatView[];
  onChange: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function invite() {
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/personas/${personaId}/seats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    const body = (await res.json().catch(() => ({}))) as { error?: string; emailSent?: boolean };
    if (!res.ok) {
      setMsg(body.error ?? "Invite failed");
      return;
    }
    setEmail("");
    setMsg(body.emailSent ? "Invite sent." : "Seat created (email failed — copy the link below).");
    onChange();
  }

  async function revoke(seatId: string) {
    const res = await fetch(`/api/personas/${personaId}/seats/${seatId}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@email.com"
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#22d3ee]"
        />
        <button
          onClick={invite}
          disabled={busy}
          className="rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 disabled:opacity-50"
        >
          Invite
        </button>
      </div>
      {msg && <p className="text-xs text-[#22d3ee]">{msg}</p>}

      {seats.length === 0 ? (
        <p className="text-sm text-slate-500">No team members yet. Invite someone above.</p>
      ) : (
        <ul className="space-y-1.5">
          {seats.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="text-slate-300 truncate">{s.invited_email}</div>
                <div className="text-[11px] text-slate-500">
                  {s.revoked_at ? "revoked" : s.accepted_at ? "active" : "pending"} · {s.role}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                {!s.revoked_at && s.inviteUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(s.inviteUrl ?? "").catch(() => {})}
                    className="text-xs text-slate-400 hover:text-[#22d3ee]"
                  >
                    copy link
                  </button>
                )}
                {!s.revoked_at && (
                  <button onClick={() => revoke(s.id)} className="text-xs text-slate-500 hover:text-red-400">
                    revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Conversations ──────────────────────────────────────────────────────────────────────
type ConvoView = {
  id: string;
  started_at: string;
  message_count: number;
  seatEmail: string | null;
};
type MsgView = { id: string; role: string; content: string; created_at: string };
function ConversationsTab({ personaId }: { personaId: string }) {
  const [convos, setConvos] = useState<ConvoView[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgView[]>([]);

  useEffect(() => {
    fetch(`/api/personas/${personaId}/conversations`)
      .then((r) => (r.ok ? (r.json() as Promise<{ conversations: ConvoView[] }>) : Promise.reject()))
      .then((b) => setConvos(b.conversations))
      .catch(() => setConvos([]));
  }, [personaId]);

  async function open(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    const res = await fetch(`/api/personas/${personaId}/conversations?conversationId=${id}`);
    if (res.ok) setMessages(((await res.json()) as { messages: MsgView[] }).messages);
  }

  if (!convos) return <p className="text-sm text-slate-500">Loading…</p>;
  if (convos.length === 0) return <p className="text-sm text-slate-500">No conversations yet.</p>;

  return (
    <ul className="space-y-2">
      {convos.map((c) => (
        <li key={c.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
          <button
            onClick={() => open(c.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left"
          >
            <span className="text-slate-300">{c.seatEmail ?? "Anonymous link"}</span>
            <span className="text-xs text-slate-500">
              {c.message_count} msgs · {new Date(c.started_at).toLocaleDateString()}
            </span>
          </button>
          {openId === c.id && (
            <div className="border-t border-slate-800 px-3 py-3 space-y-2">
              {messages.filter((m) => m.role !== "system").map((m) => (
                <div key={m.id} className="text-sm">
                  <span className={m.role === "user" ? "text-slate-400" : "text-[#22d3ee]"}>
                    {m.role === "user" ? "User" : "Agent"}:
                  </span>{" "}
                  <span className="text-slate-300 whitespace-pre-wrap">{m.content}</span>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Leads (Wave 2 owner queue) ──────────────────────────────────────────────────────────
type LeadView = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  source: string;
  status: string;
  created_at: string;
};
const LEAD_STATUS_OPTIONS = ["new", "contacted", "qualified", "junk"] as const;
function LeadsTab({ personaId }: { personaId: string }) {
  const [leads, setLeads] = useState<LeadView[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/personas/${personaId}/leads`);
    if (res.ok) setLeads(((await res.json()) as { leads: LeadView[] }).leads);
    else setLeads([]);
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(leadId: string, status: string) {
    const res = await fetch(`/api/personas/${personaId}/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, status }),
    });
    if (res.ok) load();
  }

  if (!leads) return <p className="text-sm text-slate-500">Loading…</p>;
  if (leads.length === 0)
    return (
      <p className="text-sm text-slate-500">
        No leads captured yet. Leads from your public link or widget land here (and in your
        Pocket Agent inbox).
      </p>
    );

  return (
    <ul className="space-y-2">
      {leads.map((l) => (
        <li key={l.id} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-200 truncate">{l.name || l.email || l.phone || "Visitor"}</div>
              <div className="text-[11px] text-slate-500 truncate">
                {[l.email, l.phone].filter(Boolean).join(" · ") || "no contact captured"} · {l.source} ·{" "}
                {new Date(l.created_at).toLocaleDateString()}
              </div>
            </div>
            <select
              value={l.status}
              onChange={(e) => setStatus(l.id, e.target.value)}
              className="shrink-0 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-[#22d3ee]"
            >
              {LEAD_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────────────
function SettingsTab({
  personaId,
  bundle,
  onChange,
}: {
  personaId: string;
  bundle: Bundle;
  onChange: () => void;
}) {
  const { persona } = bundle;
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(status: PersonaStatus) {
    const res = await fetch(`/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setMsg(`Status: ${status}`);
      onChange();
    }
  }

  async function regenerate() {
    const res = await fetch(`/api/personas/${personaId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate: true }),
    });
    if (res.ok) setMsg("Share links regenerated — old links no longer work.");
  }

  return (
    <div className="space-y-4 text-sm">
      {msg && <p className="text-xs text-[#22d3ee]">{msg}</p>}

      <ModeSection personaId={personaId} bundle={bundle} onChange={onChange} />
      {persona.mode === "widget" && bundle.publicModesEnabled && (
        <WidgetConfigForm personaId={personaId} tier={bundle.tier} />
      )}

      <SettingRow
        title={persona.status === "paused" ? "Resume persona" : "Pause persona"}
        desc="Paused personas refuse new messages from your team."
        action={
          <button
            onClick={() => patch(persona.status === "paused" ? "active" : "paused")}
            className="rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800"
          >
            {persona.status === "paused" ? "Resume" : "Pause"}
          </button>
        }
      />
      <SettingRow
        title="Regenerate share link"
        desc="Invalidates every existing link and creates a fresh one."
        action={
          <button
            onClick={regenerate}
            className="rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800"
          >
            Regenerate
          </button>
        }
      />
      <SettingRow
        title="Archive persona"
        desc="Hides it from your catalog. Conversations are kept."
        action={
          <button
            onClick={() => patch("archived")}
            className="rounded-md border border-red-500/40 text-red-300 px-3 py-1.5 hover:bg-red-500/10"
          >
            Archive
          </button>
        }
      />
    </div>
  );
}

// ── Mode toggle (Wave 2) ────────────────────────────────────────────────────────────────
function ModeSection({
  personaId,
  bundle,
  onChange,
}: {
  personaId: string;
  bundle: Bundle;
  onChange: () => void;
}) {
  const { persona, publicModesEnabled, publicLink } = bundle;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function setMode(mode: PersonaMode) {
    if (mode === persona.mode || busy) return;
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setBusy(false);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setNote(body.error ?? "Couldn't change mode.");
      return;
    }
    setNote("Mode changed — your old share link was revoked and a new one issued.");
    onChange();
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div>
        <div className="text-slate-200">Sharing mode</div>
        <div className="text-xs text-slate-500 mt-0.5">
          How this persona is shared. Changing it revokes the current link and issues a new one.
        </div>
      </div>

      <div className="space-y-2">
        {PERSONA_MODES.map((m) => {
          const isPublic = m === "public_link" || m === "widget";
          const locked = isPublic && !publicModesEnabled;
          const selected = persona.mode === m;
          return (
            <label
              key={m}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                selected ? "border-[#22d3ee] bg-[#22d3ee]/5" : "border-slate-800"
              } ${locked ? "opacity-60" : "cursor-pointer hover:border-slate-700"}`}
            >
              <input
                type="radio"
                name="persona-mode"
                checked={selected}
                disabled={locked || busy}
                onChange={() => setMode(m)}
                className="mt-0.5 accent-[#22d3ee]"
              />
              <span className="min-w-0">
                <span className="text-sm text-slate-200">{PERSONA_MODE_LABELS[m]}</span>
                {locked && (
                  <span className="block text-[11px] text-amber-400/80 mt-0.5">
                    Coming soon — public + widget modes go live after adversarial testing.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {note && <p className="text-xs text-[#22d3ee]">{note}</p>}

      {(persona.mode === "public_link" || persona.mode === "widget") && publicLink && (
        <div className="flex items-center gap-2 pt-1">
          <input
            readOnly
            value={publicLink}
            className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-300 outline-none"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(publicLink).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="shrink-0 text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Widget config form (Mode C) ─────────────────────────────────────────────────────────
type WidgetConfig = {
  allowed_origins: string[];
  greeting_text: string;
  bubble_color: string;
  bubble_position: "bottom-right" | "bottom-left";
  lead_capture_timing: "pre_chat" | "mid_conversation" | "post_conversation" | "off";
  lead_capture_enabled: boolean;
  off_topic_message: string | null;
  badge_removed: boolean;
};
function WidgetConfigForm({ personaId, tier }: { personaId: string; tier: string }) {
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [badgeRemovable, setBadgeRemovable] = useState(false);
  const [originsText, setOriginsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/personas/${personaId}/widget-config`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      config: WidgetConfig;
      badgeRemovable: boolean;
      snippet: string | null;
    };
    setCfg(body.config);
    setBadgeRemovable(body.badgeRemovable);
    setSnippet(body.snippet);
    setOriginsText((body.config.allowed_origins ?? []).join("\n"));
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    const allowed_origins = originsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch(`/api/personas/${personaId}/widget-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cfg, allowed_origins }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setMsg("Saved.");
    load();
  }

  if (!cfg) return <p className="text-xs text-slate-500">Loading widget config…</p>;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="text-slate-200">Website widget</div>

      {snippet && (
        <div>
          <span className="text-xs text-slate-500">Embed snippet (paste before &lt;/body&gt;)</span>
          <textarea
            readOnly
            value={snippet}
            rows={2}
            className="mt-1 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-[11px] font-mono text-slate-300 outline-none"
          />
        </div>
      )}

      <div>
        <span className="text-xs text-slate-500">Allowed domains (one per line)</span>
        <textarea
          value={originsText}
          onChange={(e) => setOriginsText(e.target.value)}
          rows={3}
          placeholder="https://yourdomain.com"
          className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#22d3ee]"
        />
        <span className="text-[11px] text-slate-600">
          The widget only runs on these domains. Empty = the widget won&apos;t load anywhere.
        </span>
      </div>

      <TextRow label="Greeting" value={cfg.greeting_text} onChange={(v) => setCfg({ ...cfg, greeting_text: v })} />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">Bubble color</span>
          <input
            value={cfg.bubble_color}
            onChange={(e) => setCfg({ ...cfg, bubble_color: e.target.value })}
            className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#22d3ee]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Position</span>
          <select
            value={cfg.bubble_position}
            onChange={(e) => setCfg({ ...cfg, bubble_position: e.target.value as WidgetConfig["bubble_position"] })}
            className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#22d3ee]"
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">Lead capture</span>
          <select
            value={cfg.lead_capture_timing}
            onChange={(e) =>
              setCfg({ ...cfg, lead_capture_timing: e.target.value as WidgetConfig["lead_capture_timing"] })
            }
            className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#22d3ee]"
          >
            <option value="pre_chat">Pre-chat form</option>
            <option value="mid_conversation">Mid-conversation</option>
            <option value="post_conversation">Post-conversation</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="flex items-center gap-2 mt-5">
          <input
            type="checkbox"
            checked={cfg.lead_capture_enabled}
            onChange={(e) => setCfg({ ...cfg, lead_capture_enabled: e.target.checked })}
            className="accent-[#22d3ee]"
          />
          <span className="text-xs text-slate-400">Capture leads</span>
        </label>
      </div>

      <TextRow
        label="Off-topic message (optional)"
        value={cfg.off_topic_message ?? ""}
        onChange={(v) => setCfg({ ...cfg, off_topic_message: v || null })}
      />

      <label className={`flex items-center gap-2 ${badgeRemovable ? "" : "opacity-60"}`}>
        <input
          type="checkbox"
          checked={cfg.badge_removed}
          disabled={!badgeRemovable}
          onChange={(e) => setCfg({ ...cfg, badge_removed: e.target.checked })}
          className="accent-[#22d3ee]"
        />
        <span className="text-xs text-slate-400">
          Remove &quot;Built with Pocket Agent&quot; badge
          {!badgeRemovable && <span className="text-amber-400/80"> (Studio plan)</span>}
        </span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs rounded-md bg-[#22d3ee] text-[#06222a] font-semibold px-3 py-1.5 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save widget config"}
        </button>
        {msg && <span className="text-xs text-[#22d3ee]">{msg}</span>}
        <span className="text-[11px] text-slate-600">{tier} plan</span>
      </div>
    </div>
  );
}

function TextRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#22d3ee]"
      />
    </label>
  );
}

function SettingRow({
  title,
  desc,
  action,
}: {
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div>
        <div className="text-slate-200">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
