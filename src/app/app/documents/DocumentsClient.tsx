"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FileUploadZone from "../_components/FileUploadZone";
import Mascot from "@/components/Mascot";
import { TabGuide } from "../_components/TabGuide";
import type { BrainFile } from "@/app/api/app/brain/files/route";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FilesResponse = { files: BrainFile[] };
type FileContentResponse = { path: string; content: string; kind: string };

// ─── Utilities ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function areaLabel(area: BrainFile["area"]): string {
  if (area === "memory") return "What your agent knows";
  if (area === "assets") return "Uploaded files";
  return "Other";
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M2.5 1.5h5.5L10.5 4v7.5h-8v-10z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M8 1.5V4h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Inline Markdown Viewer ─────────────────────────────────────────────────────

function MarkdownViewer({
  file,
  onClose,
}: {
  file: BrainFile;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/app/brain/file?path=${encodeURIComponent(file.path)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FileContentResponse>) : Promise.reject(new Error(`${r.status}`))))
      .then((d) => { setContent(d.content); setLoading(false); })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load file";
        setError(msg);
        setLoading(false);
      });
  }, [file.path]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-10 pb-6 px-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0b1017] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60 shrink-0">
          <span className="text-[#22d3ee]/60">
            <DocIcon />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{file.friendlyName}</p>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate">{file.path}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 shrink-0"
            aria-label="Close viewer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]/60 animate-pulse" />
              Loading…
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 py-4">
              Could not load this file. {error}
            </p>
          ) : content ? (
            <div className="prose-brain">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4">File is empty.</p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800/40 shrink-0">
          <p className="text-[10px] font-mono text-slate-600">
            Last updated {relativeTime(file.lastModified)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── File Row ───────────────────────────────────────────────────────────────────

function FileRow({
  file,
  onView,
}: {
  file: BrainFile;
  onView: (f: BrainFile) => void;
}) {
  const canPreview = file.kind === "markdown" || file.kind === "text";

  return (
    <button
      onClick={() => canPreview && onView(file)}
      disabled={!canPreview}
      className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 last:border-b-0 text-left transition-colors group ${
        canPreview
          ? "hover:bg-slate-800/30 cursor-pointer"
          : "cursor-default"
      }`}
    >
      <span className="shrink-0 text-slate-600 group-hover:text-[#22d3ee]/60 transition-colors">
        <DocIcon />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{file.friendlyName}</p>
        <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate">{file.path}</p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <span className="text-[10px] font-mono text-slate-600 hidden sm:block">
          {relativeTime(file.lastModified)}
        </span>
        {canPreview && (
          <span className="text-[10px] font-mono text-[#22d3ee]/40 group-hover:text-[#22d3ee]/70 transition-colors hidden sm:block">
            view →
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────────

function Section({
  area,
  files,
  onView,
}: {
  area: BrainFile["area"];
  files: BrainFile[];
  onView: (f: BrainFile) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors text-left"
      >
        <span
          className="text-[10px] font-mono text-slate-500 transition-transform duration-150"
          style={{ display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
        <span className="text-[11px] font-mono text-slate-300 tracking-[0.12em] uppercase font-semibold flex-1">
          {areaLabel(area)}
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          {files.length} file{files.length !== 1 ? "s" : ""}
        </span>
      </button>
      {!collapsed && (
        <div>
          {files.map((f) => (
            <FileRow key={f.path} file={f} onView={onView} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ hasGithubToken }: { hasGithubToken: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-5 py-10 px-6">
      <Mascot state="documents" size={120} />
      <div className="space-y-2 max-w-sm">
        <p className="text-base font-semibold text-slate-200">No documents yet</p>
        {!hasGithubToken ? (
          <p className="text-sm text-slate-400 leading-relaxed">
            Connect GitHub so your agent has a place to learn and remember.{" "}
            <a href="/api/app/auth/github?next=/app/documents" className="text-[#22d3ee] hover:underline">
              Connect GitHub →
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">
            Finish setting up your brain and your agent&apos;s knowledge will appear here.{" "}
            <a href="/app/onboarding" className="text-[#22d3ee] hover:underline">
              Set up brain →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function DocumentsClient({
  brainRepo,
  hasGithubToken,
}: {
  brainRepo: string | null;
  hasGithubToken: boolean;
}) {
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewingFile, setViewingFile] = useState<BrainFile | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadFiles = useCallback(() => {
    if (!brainRepo) { setLoading(false); return; }
    setLoading(true);
    fetch("/api/app/brain/files")
      .then((r) => (r.ok ? (r.json() as Promise<FilesResponse>) : Promise.reject()))
      .then((d) => { setFiles(d.files); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brainRepo]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const lc = search.trim().toLowerCase();
  const filtered = lc
    ? files.filter(
        (f) =>
          f.friendlyName.toLowerCase().includes(lc) ||
          f.path.toLowerCase().includes(lc),
      )
    : files;

  // Group by area
  const byArea = new Map<BrainFile["area"], BrainFile[]>();
  for (const f of filtered) {
    const arr = byArea.get(f.area) ?? [];
    arr.push(f);
    byArea.set(f.area, arr);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Documents</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Everything your agent knows about your business
            </p>
          </div>
          {brainRepo && (
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 transition-all"
            >
              + Upload
            </button>
          )}
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          These are the actual files your agent works from — proposals, contracts, your services
          PDF, a photo of the whiteboard, anything you&apos;ve uploaded or shared in. When you add
          a file, your agent reads it and pulls the important parts into its memory, so it can use
          what&apos;s inside without you re-explaining. Ask it to open the warehouse-build proposal
          or find every file that mentions the Delgado job and it goes straight to the right one.
          Upload here, or send things in from your phone through Capture.
        </p>

        {/* Upload zone (toggled) */}
        {showUpload && brainRepo && (
          <FileUploadZone
            compact={false}
            onAbsorbed={() => {
              setShowUpload(false);
              setTimeout(loadFiles, 1200);
            }}
          />
        )}

        {/* Search */}
        {brainRepo && !loading && files.length > 0 && (
          <div
            className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2.5"
            style={{ "--tw-ring-opacity": 0 } as React.CSSProperties}
          >
            <span className="text-slate-600 shrink-0">
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
        )}

        {/* Body */}
        {!brainRepo ? (
          <EmptyState hasGithubToken={hasGithubToken} />
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Mascot state="working" size={80} />
            <p className="text-[12px] font-mono text-slate-500">loading your documents…</p>
          </div>
        ) : filtered.length === 0 ? (
          search ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No documents match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 flex flex-col items-center gap-4 py-12 px-6 text-center">
              <p className="text-sm text-slate-400">Your brain is connected but has no files yet.</p>
              <div className="text-xs text-slate-500 leading-relaxed">
                Complete the brain setup to add context, or upload files here.
              </div>
              <a
                href="/app/onboarding"
                className="text-sm font-mono text-[#22d3ee] hover:underline"
              >
                Set up brain →
              </a>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {search && (
              <p className="text-[11px] font-mono text-slate-500">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
              </p>
            )}
            {(["memory", "assets"] as BrainFile["area"][]).map((area) => {
              const areaFiles = byArea.get(area);
              if (!areaFiles || areaFiles.length === 0) return null;
              return (
                <Section
                  key={area}
                  area={area}
                  files={areaFiles}
                  onView={setViewingFile}
                />
              );
            })}
          </div>
        )}

        {/* Info footer */}
        {brainRepo && !loading && files.length > 0 && (
          <div className="rounded-xl border border-slate-800/40 bg-slate-900/20 px-4 py-3">
            <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
              Your agent reads these files before every reply.{" "}
              <a href="/app/capture" className="text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors">
                Upload more →
              </a>
            </p>
          </div>
        )}

        {/* First-touch guide — what to ask, what this connects to, and a sample file list */}
        <TabGuide
          promptsHeading="Try one of these"
          prompts={[
            "Open the warehouse-build proposal",
            "Find every file that mentions the Delgado job",
            "Pull the pricing out of my services PDF",
          ]}
          worksWith={[
            {
              href: "/app/brain",
              label: "Brain",
              blurb: "What your agent absorbs from these files becomes part of what it knows.",
            },
            {
              href: "/app/capture",
              label: "Capture",
              blurb: "Send files in from your phone — a photo, a voice memo, a shared doc.",
            },
            {
              href: "/app/ask",
              label: "Agent",
              blurb: "Your agent opens and reads these files when a question calls for one.",
            },
          ]}
          exampleLabel="See an example of your files"
          exampleNote="This is a sample. Your real files appear above once you've uploaded or shared some in."
        >
          <ul className="flex flex-col gap-1.5">
            {[
              { n: "Warehouse-build proposal.pdf", m: "Uploaded Jun 2 · absorbed into memory" },
              { n: "Services + pricing.pdf", m: "Uploaded May 20 · absorbed into memory" },
              { n: "Whiteboard — Q3 plan.jpg", m: "Shared from iPhone Jun 5" },
            ].map((f) => (
              <li
                key={f.n}
                className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-3"
              >
                <span className="shrink-0 text-[#22d3ee]/50 text-sm">◈</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{f.n}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate">{f.m}</p>
                </div>
              </li>
            ))}
          </ul>
        </TabGuide>

      </div>

      {/* Inline viewer modal */}
      {viewingFile && (
        <MarkdownViewer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}
