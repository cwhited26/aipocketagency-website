"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PERSONA_SECTIONS } from "@/lib/personas/spec";
import type { PersonaRow, PersonaStatus } from "@/lib/personas/types";

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
};

const TABS = ["Overview", "Spec", "Knowledge", "Team", "Conversations", "Settings"] as const;
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
          {tab === "Team" && <TeamTab personaId={personaId} seats={bundle.seats} onChange={reload} />}
          {tab === "Conversations" && <ConversationsTab personaId={personaId} />}
          {tab === "Settings" && (
            <SettingsTab personaId={personaId} persona={persona} onChange={reload} />
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
      <button
        onClick={copyLink}
        className="rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
      >
        {copied ? "Share link copied!" : "Copy share link"}
      </button>
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

// ── Settings ──────────────────────────────────────────────────────────────────────────
function SettingsTab({
  personaId,
  persona,
  onChange,
}: {
  personaId: string;
  persona: PersonaRow;
  onChange: () => void;
}) {
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
