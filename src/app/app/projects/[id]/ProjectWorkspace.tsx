"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, ProjectMemoryEntry, ProjectReference } from "@/lib/pa-projects";
import type { ConversationThread } from "@/lib/pa-conversations";
import type { ScaffoldEntry } from "@/lib/pa-brain";
import type {
  ComputedWorkspaceStatus,
  ProjectWorkspace as ProjectWorkspaceRow,
  WorkspaceStatus,
} from "@/lib/projects/workspace-types";

type Tab = "plan" | "conversations" | "references" | "memory" | "workspace";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectWorkspace({
  project: initialProject,
  threads: initialThreads,
  references: initialReferences,
  memory: initialMemory,
  scaffolds,
  workspace,
  workspaceStatus,
}: {
  project: Project;
  threads: ConversationThread[];
  references: ProjectReference[];
  memory: ProjectMemoryEntry[];
  scaffolds: ScaffoldEntry[];
  workspace: ProjectWorkspaceRow | null;
  workspaceStatus: ComputedWorkspaceStatus;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("plan");
  const [project, setProject] = useState(initialProject);
  const [threads, setThreads] = useState(initialThreads);
  const [references, setReferences] = useState(initialReferences);
  const [memory, setMemory] = useState(initialMemory);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  const instructionsSet = Boolean(project.instructions?.trim());

  function openSettingsToInstructions() {
    setSettingsOpen(true);
    // Let the drawer mount, then focus the instructions field.
    setTimeout(() => instructionsRef.current?.focus(), 60);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-5">
        {/* Back */}
        <a
          href="/app/projects"
          className="text-[12px] font-mono text-slate-500 hover:text-slate-300 transition-colors self-start"
        >
          ← All projects
        </a>

        {/* Header + readiness pill */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-100 break-words">{project.title}</h1>
            {project.goal?.trim() && (
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{project.goal}</p>
            )}
          </div>
          <button
            type="button"
            onClick={openSettingsToInstructions}
            title={
              instructionsSet
                ? "Setup complete — instructions are set"
                : "Add instructions to finish setting up this project"
            }
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors min-h-[32px] ${
              instructionsSet
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            }`}
          >
            <span>{instructionsSet ? "✓" : "●"}</span>
            <span>{instructionsSet ? "Set up" : "Finish setup"}</span>
          </button>
        </div>

        {/* Settings button */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="self-start rounded-lg border border-slate-700/60 px-3 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-slate-800/40 transition-colors min-h-[36px]"
        >
          ⚙ Project settings
        </button>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800/60">
          <TabButton active={tab === "plan"} onClick={() => setTab("plan")} label="Plan" />
          <TabButton
            active={tab === "conversations"}
            onClick={() => setTab("conversations")}
            label="Conversations"
            count={threads.length}
          />
          <TabButton
            active={tab === "references"}
            onClick={() => setTab("references")}
            label="References"
            count={references.length}
          />
          <TabButton
            active={tab === "memory"}
            onClick={() => setTab("memory")}
            label="Memory"
            count={memory.length}
          />
          <TabButton
            active={tab === "workspace"}
            onClick={() => setTab("workspace")}
            label="Workspace"
            count={workspaceStatus.provisionedCount}
          />
        </div>

        {/* Tab body */}
        {tab === "plan" && (
          <PlanTab project={project} scaffolds={scaffolds} router={router} />
        )}
        {tab === "conversations" && (
          <ConversationsTab
            projectId={project.id}
            threads={threads}
            setThreads={setThreads}
            router={router}
          />
        )}
        {tab === "references" && (
          <ReferencesTab
            projectId={project.id}
            references={references}
            setReferences={setReferences}
          />
        )}
        {tab === "memory" && (
          <MemoryTab projectId={project.id} memory={memory} setMemory={setMemory} />
        )}
        {tab === "workspace" && (
          <WorkspaceTab workspace={workspace} status={workspaceStatus} />
        )}
      </div>

      {settingsOpen && (
        <SettingsDrawer
          project={project}
          setProject={setProject}
          instructionsRef={instructionsRef}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// ── Tab button ──────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3.5 py-2.5 text-sm font-medium transition-colors min-h-[40px] ${
        active ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="ml-1.5 text-[11px] font-mono text-slate-500">{count}</span>
      )}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#22d3ee]" />}
    </button>
  );
}

// ── Plan tab ──────────────────────────────────────────────────────────────────

function PlanTab({
  project,
  scaffolds,
  router,
}: {
  project: Project;
  scaffolds: ScaffoldEntry[];
  router: ReturnType<typeof useRouter>;
}) {
  const [ask, setAsk] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start a project-linked conversation, optionally pre-filling the composer with the big ask.
  async function startThread(prefill: string) {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/projects/${project.id}/conversations`, { method: "POST" });
      const data = (await res.json()) as { conversation?: { id: string }; error?: string };
      if (!res.ok || !data.conversation) {
        setError(data.error || "Couldn't start a conversation.");
        setStarting(false);
        return;
      }
      const q = prefill.trim() ? `&q=${encodeURIComponent(prefill.trim())}` : "";
      router.push(`/app/ask?c=${data.conversation.id}${q}`);
    } catch {
      setError("Network error. Try again.");
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-300 leading-relaxed">
        This is the work itself. Hand your agent the project&apos;s big ask and it writes a plan —
        milestones and tasks — for you to approve before anything runs. The conversation it opens is
        already part of this project, so it knows your instructions, files, and memory from the
        first message.
      </p>

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
        <textarea
          rows={3}
          placeholder={project.goal?.trim() ? `Plan this: ${project.goal}` : "What do you want this project to get done?"}
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 transition-colors resize-none leading-relaxed"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => startThread(ask || (project.goal ?? ""))}
            disabled={starting}
            className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px]"
          >
            {starting ? "Opening…" : "Plan it →"}
          </button>
        </div>
      </div>

      {scaffolds.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Plans in your brain
          </span>
          <ul className="flex flex-col gap-1.5">
            {scaffolds.map((s) => (
              <li key={s.slug}>
                <a
                  href="/app/documents"
                  className="group flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 hover:border-slate-600 hover:bg-slate-900 transition-all min-h-[52px]"
                >
                  <span className="text-[#22d3ee]/60 shrink-0 text-sm">◆</span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-slate-200 truncate">
                    {s.slug.replace(/[-_]+/g, " ")}
                  </p>
                  <span className="shrink-0 text-[11px] font-mono text-slate-600 group-hover:text-[#22d3ee]/70 transition-colors">
                    View plan →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Conversations tab ───────────────────────────────────────────────────────────

function ConversationsTab({
  projectId,
  threads,
  setThreads,
  router,
}: {
  projectId: string;
  threads: ConversationThread[];
  setThreads: (next: ConversationThread[]) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function newConversation() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/projects/${projectId}/conversations`, { method: "POST" });
      const data = (await res.json()) as { conversation?: { id: string }; error?: string };
      if (!res.ok || !data.conversation) {
        setError(data.error || "Couldn't start a conversation.");
        setBusy(false);
        return;
      }
      router.push(`/app/ask?c=${data.conversation.id}`);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  async function patchThread(id: string, patch: { pinned?: boolean; title?: string; projectId?: null }) {
    const res = await fetch(`/api/app/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Update failed.");
      return false;
    }
    return true;
  }

  async function togglePin(t: ConversationThread) {
    const ok = await patchThread(t.id, { pinned: !t.pinned });
    if (!ok) return;
    const next = threads
      .map((x) => (x.id === t.id ? { ...x, pinned: !t.pinned } : x))
      .sort((a, b) =>
        a.pinned === b.pinned
          ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          : a.pinned
            ? -1
            : 1,
      );
    setThreads(next);
  }

  async function commitRename(t: ConversationThread) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === t.title) return;
    const ok = await patchThread(t.id, { title });
    if (!ok) return;
    setThreads(threads.map((x) => (x.id === t.id ? { ...x, title } : x)));
  }

  async function removeFromProject(t: ConversationThread) {
    const ok = await patchThread(t.id, { projectId: null });
    if (!ok) return;
    setThreads(threads.filter((x) => x.id !== t.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300 leading-relaxed">
        Every conversation in this project shares its instructions, files, and memory. Start new
        threads here, pin the ones you keep coming back to, and remove any that don&apos;t belong.
      </p>

      <button
        type="button"
        onClick={newConversation}
        disabled={busy}
        className="self-start rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 transition-colors min-h-[40px]"
      >
        {busy ? "Opening…" : "+ New conversation"}
      </button>
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {threads.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No conversations in this project yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {threads.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 flex flex-col gap-2"
            >
              {renamingId === t.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(t);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => commitRename(t)}
                  className="w-full rounded-lg border border-[#22d3ee]/50 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(`/app/ask?c=${t.id}`)}
                  className="text-left min-w-0"
                >
                  <div className="flex items-center gap-2">
                    {t.pinned && <span className="text-[#22d3ee]/70 text-xs shrink-0">★</span>}
                    <span className="text-sm font-medium text-slate-200 truncate">{t.title}</span>
                  </div>
                  {t.snippet && (
                    <p className="text-[12px] text-slate-500 truncate mt-0.5">{t.snippet}</p>
                  )}
                </button>
              )}
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600">
                <span>{relativeTime(t.updated_at)}</span>
                <span className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => togglePin(t)}
                    className="hover:text-[#22d3ee]/80 transition-colors"
                  >
                    {t.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(t.id);
                      setRenameValue(t.title);
                    }}
                    className="hover:text-slate-300 transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromProject(t)}
                    className="hover:text-rose-400 transition-colors"
                  >
                    Remove
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── References tab ──────────────────────────────────────────────────────────────

function ReferencesTab({
  projectId,
  references,
  setReferences,
}: {
  projectId: string;
  references: ProjectReference[];
  setReferences: (next: ProjectReference[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/app/projects/${projectId}/references`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { reference?: ProjectReference; error?: string };
      if (!res.ok || !data.reference) {
        setError(data.error || "Upload failed.");
        return;
      }
      setReferences([data.reference, ...references]);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function savePaste() {
    const name = pasteName.trim();
    const text = pasteText.trim();
    if (!name || !text || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/projects/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name, contentText: text }),
      });
      const data = (await res.json()) as { reference?: ProjectReference; error?: string };
      if (!res.ok || !data.reference) {
        setError(data.error || "Save failed.");
        return;
      }
      setReferences([data.reference, ...references]);
      setPasteOpen(false);
      setPasteName("");
      setPasteText("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/app/projects/${projectId}/references/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Delete failed.");
      return;
    }
    setReferences(references.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300 leading-relaxed">
        Upload docs every conversation in this project can read — a brief, a contract, a spec, a
        screenshot. Text files and PDFs go in as-is; images and PDFs get read for you. Paste text
        directly when you don&apos;t have a file.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 transition-colors min-h-[40px]"
        >
          {uploading ? "Working…" : "Upload a file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt,.csv,.tsv,.json,.xml,.yml,.yaml,image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="rounded-lg border border-slate-700/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/40 transition-colors min-h-[40px]"
        >
          Paste text
        </button>
      </div>

      {pasteOpen && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Title — e.g. Statement of work"
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50"
          />
          <textarea
            rows={5}
            placeholder="Paste the reference text…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 resize-none leading-relaxed"
          />
          <button
            type="button"
            onClick={savePaste}
            disabled={!pasteName.trim() || !pasteText.trim() || uploading}
            className="self-start rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 transition-colors min-h-[40px]"
          >
            Save reference
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {references.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No reference files yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {references.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#22d3ee]/60 shrink-0 text-sm">▤</span>
                <span className="text-sm font-medium text-slate-200 truncate flex-1">{r.file_name}</span>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="shrink-0 text-[11px] font-mono text-slate-600 hover:text-rose-400 transition-colors"
                >
                  Remove
                </button>
              </div>
              <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                {r.content_text.slice(0, 200)}
              </p>
              <span className="text-[10px] font-mono text-slate-600">{relativeTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Memory tab ──────────────────────────────────────────────────────────────────

function MemoryTab({
  projectId,
  memory,
  setMemory,
}: {
  projectId: string;
  memory: ProjectMemoryEntry[];
  setMemory: (next: ProjectMemoryEntry[]) => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const body = value.trim();
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/projects/${projectId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json()) as { entry?: ProjectMemoryEntry; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error || "Couldn't save.");
        return;
      }
      setMemory([data.entry, ...memory]);
      setValue("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/app/projects/${projectId}/memory/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Delete failed.");
      return;
    }
    setMemory(memory.filter((m) => m.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300 leading-relaxed">
        Notes that stay inside this project. Your agent saves the durable facts and decisions it
        learns while working here, and you can add your own. None of it spills into the rest of your
        brain — it&apos;s scoped to this project.
      </p>

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
        <textarea
          rows={2}
          placeholder="Add a note for this project — a fact, a decision, a preference"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 resize-none leading-relaxed"
        />
        <button
          type="button"
          onClick={add}
          disabled={!value.trim() || saving}
          className="self-start rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 transition-colors min-h-[40px]"
        >
          {saving ? "Saving…" : "Add to project memory"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {memory.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No project memory yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {memory.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 flex items-start gap-3"
            >
              <span className="text-[#22d3ee]/50 shrink-0 text-sm mt-0.5">◆</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                  {m.body}
                </p>
                <span className="text-[10px] font-mono text-slate-600">{relativeTime(m.created_at)}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="shrink-0 text-[11px] font-mono text-slate-600 hover:text-rose-400 transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Workspace tab ─────────────────────────────────────────────────────────────────

const WORKSPACE_STATUS_COPY: Record<WorkspaceStatus, { label: string; className: string }> = {
  provisioning: {
    label: "Building",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  live: {
    label: "Live",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  failed: {
    label: "Needs attention",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
  archived: {
    label: "Archived",
    className: "border-slate-600/40 bg-slate-700/20 text-slate-400",
  },
};

function WorkspaceTab({
  workspace,
  status,
}: {
  workspace: ProjectWorkspaceRow | null;
  status: ComputedWorkspaceStatus;
}) {
  const statusCopy = WORKSPACE_STATUS_COPY[status.stored];
  const vercelLiveUrl = workspace?.vercel_project_name
    ? `https://${workspace.vercel_project_name}.vercel.app`
    : null;
  const supabaseDashboardUrl = workspace?.supabase_project_ref
    ? `https://supabase.com/dashboard/project/${workspace.supabase_project_ref}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300 leading-relaxed">
        When your agent builds something real for this project — a code repository, a live website, a
        database, a place to run the build — every piece shows up here, on your own accounts. One place
        that answers &ldquo;where did this end up,&rdquo; each one a tappable link to the real thing.
      </p>

      {/* Overall status */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${statusCopy.className}`}
        >
          {statusCopy.label}
        </span>
        <span className="text-[12px] font-mono text-slate-500">
          {status.provisionedCount} of {status.total} pieces set up
        </span>
      </div>

      {status.provisionedCount === 0 && (
        <p className="text-sm text-slate-500 italic leading-relaxed">
          Nothing built yet. Hand your agent a build plan from the Plan tab — once it creates a repo,
          deploys a site, or provisions a database, the pieces land here.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* GitHub */}
        <ArtifactCard
          icon="❮❯"
          title="Code repository"
          provider="GitHub"
          provisioned={status.artifacts.github}
          primary={
            workspace?.github_repo_url
              ? {
                  label: workspace.github_repo_full_name ?? "Open repository",
                  href: workspace.github_repo_url,
                }
              : null
          }
          emptyHint="Your agent creates one when a build plan needs code."
        />

        {/* Vercel */}
        <ArtifactCard
          icon="▲"
          title="Live website"
          provider="Vercel"
          provisioned={status.artifacts.vercel}
          primary={
            vercelLiveUrl
              ? { label: vercelLiveUrl.replace(/^https:\/\//, ""), href: vercelLiveUrl }
              : workspace?.vercel_project_name
                ? { label: workspace.vercel_project_name, href: "https://vercel.com/dashboard" }
                : null
          }
          secondary={
            status.artifacts.vercel
              ? { label: "Open in Vercel →", href: "https://vercel.com/dashboard" }
              : null
          }
          emptyHint="The deployed site appears here once your agent ships it."
        />

        {/* Supabase */}
        <ArtifactCard
          icon="⬡"
          title="Database"
          provider="Supabase"
          provisioned={status.artifacts.supabase}
          primary={
            supabaseDashboardUrl
              ? {
                  label: workspace?.supabase_project_name ?? "Open dashboard",
                  href: supabaseDashboardUrl,
                }
              : null
          }
          emptyHint="Provisioned on your own Supabase when the build needs data."
        />

        {/* Modal */}
        <ArtifactCard
          icon="◷"
          title="Build sandbox"
          provider="Modal"
          provisioned={status.artifacts.modal}
          primary={
            workspace?.modal_container_id
              ? { label: "Container running", href: "https://modal.com/apps" }
              : null
          }
          subtle={workspace?.modal_container_id ?? null}
          emptyHint="A throwaway container spins up to run installs, builds, and tests."
        />
      </div>
    </div>
  );
}

function ArtifactCard({
  icon,
  title,
  provider,
  provisioned,
  primary,
  secondary,
  subtle,
  emptyHint,
}: {
  icon: string;
  title: string;
  provider: string;
  provisioned: boolean;
  primary: { label: string; href: string } | null;
  secondary?: { label: string; href: string } | null;
  subtle?: string | null;
  emptyHint: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-2.5 ${
        provisioned
          ? "border-slate-700/60 bg-slate-900/60"
          : "border-slate-800/60 bg-slate-900/30"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`text-sm shrink-0 ${provisioned ? "text-[#22d3ee]/70" : "text-slate-600"}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-200 leading-tight">{title}</p>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.12em] mt-0.5">
            {provider}
          </p>
        </div>
        {provisioned && (
          <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-400/80" title="Provisioned" />
        )}
      </div>

      {primary ? (
        <a
          href={primary.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-[#22d3ee] hover:text-[#67e8f9] transition-colors break-all"
        >
          {primary.label} →
        </a>
      ) : (
        <p className="text-[12px] text-slate-500 leading-relaxed">{emptyHint}</p>
      )}

      {subtle && (
        <p className="text-[10px] font-mono text-slate-600 break-all">{subtle}</p>
      )}

      {secondary && (
        <a
          href={secondary.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          {secondary.label}
        </a>
      )}
    </div>
  );
}

// ── Settings drawer ───────────────────────────────────────────────────────────

function SettingsDrawer({
  project,
  setProject,
  instructionsRef,
  onClose,
}: {
  project: Project;
  setProject: (next: Project) => void;
  instructionsRef: React.RefObject<HTMLTextAreaElement>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [goal, setGoal] = useState(project.goal ?? "");
  const [instructions, setInstructions] = useState(project.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/app/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          goal: goal.trim() || null,
          instructions: instructions.trim() || null,
        }),
      });
      const data = (await res.json()) as { project?: Project; error?: string };
      if (!res.ok || !data.project) {
        setError(data.error || "Couldn't save.");
        return;
      }
      setProject(data.project);
      setSaved(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="flex-1 bg-black/60"
      />
      <div className="w-full max-w-md h-full overflow-y-auto bg-[#0a0d12] border-l border-slate-800 p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Project settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-[0.14em]">
            Name
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#22d3ee]/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-[0.14em]">
            Goal
          </label>
          <textarea
            rows={2}
            value={goal}
            placeholder="One line — what this project is driving toward"
            onChange={(e) => setGoal(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 resize-none leading-relaxed"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-[0.14em]">
            Instructions
          </label>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            The rulebook for this project. Every conversation in the project starts with this — your
            conventions, your voice, what to do and what to avoid. Write it like you&apos;re briefing
            someone new on the work.
          </p>
          <textarea
            ref={instructionsRef}
            rows={10}
            value={instructions}
            placeholder={"e.g.\nAlways write in a warm, direct tone.\nThis project is for the Henderson account — never reference other clients.\nDeadlines are firm; flag anything at risk."}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#22d3ee]/50 resize-none leading-relaxed font-mono"
          />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {saved && <p className="text-xs text-emerald-400">Saved.</p>}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!title.trim() || saving}
            className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 transition-colors min-h-[40px]"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/40 transition-colors min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
