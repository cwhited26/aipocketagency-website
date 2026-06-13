"use client";

import { useEffect, useState } from "react";
import type { LandingPageView } from "@/lib/landing-pages/types";
import type { ProjectFolder } from "@/lib/landing-pages/scope";
import { AppEmptyState } from "@/app/app/_components/AppEmptyState";
import { AddonPrompt } from "@/app/app/_components/AddonPrompt";
import { LANDING_PAGE } from "@/lib/copy/in-app";

type TemplateOption = { id: string; label: string; description: string; bestFor: string };

type Props = {
  initialPages: LandingPageView[];
  templates: TemplateOption[];
  canBuild: boolean;
  hasApiKey: boolean;
  moonchildConfigured: boolean;
  urlImportEnabled: boolean;
};

const STATUS_LABEL: Record<LandingPageView["status"], string> = {
  planning: "Draft",
  building: "Building",
  live: "Live",
  failed: "Stopped",
};

const STEP_LABEL: Record<LandingPageView["buildStep"], string> = {
  plan: "ready to build",
  repo: "waiting on your approval — create the repo",
  push: "waiting on your approval — add the files",
  project: "waiting on your approval — create the Vercel project",
  deploy: "waiting on your approval — deploy",
  live: "live",
  failed: "stopped",
};

function statusClass(status: LandingPageView["status"]): string {
  if (status === "live") return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
  if (status === "building") return "text-[#22d3ee] border-[#22d3ee]/30 bg-[#22d3ee]/10";
  if (status === "failed") return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  return "text-slate-400 border-slate-700 bg-slate-900/60";
}

export default function LandingPagesClient({ initialPages, templates, canBuild, hasApiKey, moonchildConfigured, urlImportEnabled }: Props) {
  const [pages, setPages] = useState<LandingPageView[]>(initialPages);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<string>(templates[0]?.id ?? "single-cta");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Scope picker state (PA-LPB-9)
  const [scopeMode, setScopeMode] = useState<"personal" | "project">("personal");
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [folders, setFolders] = useState<ProjectFolder[] | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Design system wizard step (PA-LPB-10)
  type DsChoice = "url" | "existing" | "skip";
  type DsPreview = { designSystemId: string; name?: string; palette?: { name?: string; hex?: string; role?: string }[]; typography?: { heading?: { family?: string }; body?: { family?: string } }; importedFrom: string };
  const [dsChoice, setDsChoice] = useState<DsChoice>("skip");
  const [dsUrl, setDsUrl] = useState("");
  const [dsImporting, setDsImporting] = useState(false);
  const [dsPreview, setDsPreview] = useState<DsPreview | null>(null);
  const [dsError, setDsError] = useState<string | null>(null);
  const [dsBrainWritePageId, setDsBrainWritePageId] = useState<string | null>(null);
  const [dsBrainWriting, setDsBrainWriting] = useState(false);
  const [dsBrainWriteStaged, setDsBrainWriteStaged] = useState(false);

  // Reset DS wizard when scope changes
  useEffect(() => {
    setDsChoice("skip");
    setDsUrl("");
    setDsPreview(null);
    setDsError(null);
  }, [selectedScope, scopeMode]);

  useEffect(() => {
    if (scopeMode !== "project" || folders !== null) return;
    setLoadingFolders(true);
    fetch("/api/app/apps/landing-pages/project-folders")
      .then((r) => r.json() as Promise<{ folders: ProjectFolder[] }>)
      .then((data) => setFolders(data.folders ?? []))
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false));
  }, [scopeMode, folders]);

  async function importDs() {
    if (!dsUrl.trim()) return;
    setDsImporting(true);
    setDsError(null);
    setDsPreview(null);
    try {
      const res = await fetch("/api/app/apps/landing-pages/import-design-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dsUrl.trim() }),
      });
      const data = (await res.json()) as { designSystem?: { name?: string; palette?: DsPreview["palette"]; typography?: DsPreview["typography"] }; designSystemId?: string; importedFrom?: string; message?: string; error?: string };
      if (!res.ok || !data.designSystemId) {
        setDsError(data.message ?? data.error ?? "Couldn't read the design from that URL.");
        return;
      }
      setDsPreview({
        designSystemId: data.designSystemId,
        name: data.designSystem?.name,
        palette: data.designSystem?.palette,
        typography: data.designSystem?.typography,
        importedFrom: data.importedFrom ?? dsUrl.trim(),
      });
    } finally {
      setDsImporting(false);
    }
  }

  async function stageTosBrainWrite(pageId: string) {
    setDsBrainWriting(true);
    try {
      const res = await fetch(`/api/app/apps/landing-pages/${pageId}/brand-brain-write`, { method: "POST" });
      const data = (await res.json()) as { staged?: boolean; error?: string };
      if (res.ok && data.staged) setDsBrainWriteStaged(true);
    } finally {
      setDsBrainWriting(false);
    }
  }

  async function createPage() {
    if (!title.trim() || !description.trim()) {
      setError("Give the page a name and tell PA what it's for.");
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    const brainScope = scopeMode === "project" ? selectedScope : null;
    try {
      const res = await fetch("/api/app/apps/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), template, brainScope }),
      });
      const data = (await res.json()) as { page?: LandingPageView; message?: string; error?: string };
      if (!res.ok || !data.page) {
        setError(data.message ?? data.error ?? "Couldn't create the page.");
        return;
      }
      const newPage = data.page as LandingPageView;

      // If the owner imported a DS in the wizard, persist it on the new page row.
      if (dsChoice === "url" && dsPreview) {
        await fetch("/api/app/apps/landing-pages/import-design-system", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: dsPreview.importedFrom, pageId: newPage.id }),
        });
        setDsBrainWritePageId(newPage.id);
      }

      setPages((p) => [newPage, ...p]);
      setTitle("");
      setDescription("");
    } finally {
      setCreating(false);
    }
  }

  async function build(id: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/app/apps/landing-pages/${id}/build`, { method: "POST" });
      const data = (await res.json()) as { page?: LandingPageView; message?: string; error?: string };
      if (!res.ok && res.status !== 409) {
        setError(data.message ?? data.error ?? "Couldn't start the build.");
        return;
      }
      if (data.page) setPages((p) => p.map((x) => (x.id === id ? (data.page as LandingPageView) : x)));
      setNotice(
        data.message ??
          "Build started — the first step is waiting for your approval in Mission Control.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function attachDomain(id: string, domain: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/app/apps/landing-pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domain }),
      });
      const data = (await res.json()) as { staged?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't stage the domain.");
        return;
      }
      setNotice(`Approve the domain step in Mission Control and ${domain} will point at your page.`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/app/apps/landing-pages/${id}`, { method: "DELETE" });
      if (res.ok) setPages((p) => p.filter((x) => x.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {!canBuild && (
        <div className="mb-6 rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Building a page is a Studio feature</p>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            You can plan a page here. To build it on your own GitHub and Vercel, move up to Studio.{" "}
            <a href="/app/settings/tier" className="text-[#22d3ee] hover:underline">
              See plans →
            </a>
          </p>
        </div>
      )}
      {!hasApiKey && canBuild && (
        <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-4">
          <p className="text-sm font-semibold text-slate-100">Add your Anthropic API key</p>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            PA writes the page with your key.{" "}
            <a href="/app/settings" className="text-[#22d3ee] hover:underline">
              Go to Settings →
            </a>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/10 px-4 py-3 text-sm text-[#22d3ee]">
          {notice}
        </div>
      )}

      {/* The Template Gallery (PA-TG-1) — the direction catalog; the form below stays as quick start. */}
      <a
        href="/app/apps/landing-pages/templates"
        className="block mb-6 rounded-2xl border border-[#22d3ee]/30 bg-gradient-to-r from-[#22d3ee]/10 to-transparent px-5 py-4 hover:border-[#22d3ee]/50 transition-colors"
      >
        <p className="text-sm font-semibold text-slate-100">Browse the template gallery →</p>
        <p className="text-[13px] text-slate-300 mt-1 leading-relaxed">
          Twenty looks, each one a different starting point — luxury, conversion-first, cinematic,
          editorial. Pick the one that fits your business and PA builds the page in your voice.
        </p>
      </a>

      {/* Create a page */}
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-5 mb-8">
        <p className="text-sm font-semibold text-slate-100 mb-3">Quick start — create a landing page</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name it — e.g. Roofing — free inspection"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 mb-3 focus:border-[#22d3ee]/50 focus:outline-none"
        />

        {/* PA-LPB-9 — What is this page for? */}
        <p className="text-[12px] font-medium text-slate-400 mb-2">What is this page for?</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => { setScopeMode("personal"); setSelectedScope(null); }}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              scopeMode === "personal"
                ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <p className="text-[13px] font-semibold text-slate-100">Me / my business</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Reads your personal brain</p>
          </button>
          <button
            type="button"
            onClick={() => setScopeMode("project")}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              scopeMode === "project"
                ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <p className="text-[13px] font-semibold text-slate-100">A specific project or client</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Reads that project&apos;s brain folder</p>
          </button>
        </div>

        {scopeMode === "project" && (
          <div className="mb-3">
            {loadingFolders && (
              <p className="text-[12px] text-slate-500 py-2">Looking for project folders in your brain…</p>
            )}
            {!loadingFolders && folders !== null && folders.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  Your brain doesn&apos;t have project folders yet. Drop a{" "}
                  <code className="text-[#22d3ee] font-mono">brand.md</code> or a{" "}
                  <code className="text-[#22d3ee] font-mono">memory/</code> folder under any path like{" "}
                  <code className="text-[#22d3ee] font-mono">customers/name/</code> and PA will pick it up.
                  Continuing builds against your personal brain.
                </p>
              </div>
            )}
            {!loadingFolders && folders && folders.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {folders.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedScope(selectedScope === f.path ? null : f.path)}
                    className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selectedScope === f.path
                        ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                        : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {f.brandColor && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: f.brandColor }}
                        />
                      )}
                      <p className="text-[13px] font-semibold text-slate-100">{f.name}</p>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">{f.path}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{f.signals.join(" · ")}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PA-LPB-10 — Design system step (only when a project scope is selected) */}
        {scopeMode === "project" && selectedScope && (
          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-[12px] font-medium text-slate-300 mb-2">
              Base the design on a reference site?
            </p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {([
                { key: "url", label: "Match a site's look", sub: "Coming with the next update" },
                { key: "existing", label: "Use existing brand.json", sub: "If the scope already has one" },
                { key: "skip", label: "Skip — use defaults", sub: "PA picks the style" },
              ] as { key: DsChoice; label: string; sub: string }[]).map((opt) => {
                const disabled = opt.key === "url" && !urlImportEnabled;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => !disabled && setDsChoice(opt.key)}
                    disabled={disabled}
                    className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                      disabled
                        ? "border-slate-800 bg-slate-900/20 opacity-50 cursor-not-allowed"
                        : dsChoice === opt.key
                          ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                    }`}
                  >
                    <p className="text-[12px] font-semibold text-slate-100 leading-snug">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
            {!urlImportEnabled && (
              <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                Pulling a design from a URL is coming with the next update. For now, pick &ldquo;Skip&rdquo; and PA will build against the template defaults.
              </p>
            )}

            {dsChoice === "url" && (
              <div className="flex gap-2 mt-2">
                <input
                  value={dsUrl}
                  onChange={(e) => setDsUrl(e.target.value)}
                  placeholder="https://theclient.com"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#22d3ee]/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={importDs}
                  disabled={dsImporting || !dsUrl.trim()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-[13px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
                >
                  {dsImporting ? "Reading…" : "Import"}
                </button>
              </div>
            )}
            {dsError && (
              <p className="text-[11px] text-amber-300 mt-1.5">{dsError}</p>
            )}
            {dsPreview && dsChoice === "url" && (
              <div className="mt-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  {dsPreview.palette?.slice(0, 4).map((p, i) => (
                    p.hex ? (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full border border-white/10 shrink-0"
                        style={{ backgroundColor: p.hex }}
                        title={p.role ?? p.name ?? p.hex}
                      />
                    ) : null
                  ))}
                  <p className="text-[12px] font-semibold text-emerald-300">
                    {dsPreview.name ?? "Design system"} imported
                  </p>
                </div>
                {dsPreview.typography?.heading?.family && (
                  <p className="text-[11px] text-slate-400">
                    Typography: {dsPreview.typography.heading.family}
                    {dsPreview.typography.body?.family && dsPreview.typography.body.family !== dsPreview.typography.heading.family
                      ? ` / ${dsPreview.typography.body.family}`
                      : ""}
                  </p>
                )}
              </div>
            )}

            {/* Brain-write offer: after page is created and DS is imported, offer to save brand.json */}
            {dsBrainWritePageId && dsPreview && !dsBrainWriteStaged && (
              <div className="mt-2.5 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-3 py-2.5">
                <p className="text-[12px] text-slate-200 font-medium mb-1.5">
                  Save this as brand.json in your brain?
                </p>
                <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                  Future pages for this project will reuse the same design tokens — no re-import
                  needed.
                </p>
                <button
                  type="button"
                  onClick={() => stageTosBrainWrite(dsBrainWritePageId)}
                  disabled={dsBrainWriting}
                  className="rounded-lg border border-[#22d3ee]/40 px-3 py-1.5 text-[12px] text-[#22d3ee] hover:bg-[#22d3ee]/10 disabled:opacity-50"
                >
                  {dsBrainWriting ? "Staging…" : "Stage for approval →"}
                </button>
              </div>
            )}
            {dsBrainWriteStaged && (
              <p className="mt-2 text-[11px] text-emerald-300">
                brand.json staged — approve the card in Mission Control to commit it.
              </p>
            )}
          </div>
        )}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the page — &ldquo;a landing page for my roofing business with a hero, the problem we solve, how it works, and a free-inspection call to action.&rdquo;"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 mb-3 focus:border-[#22d3ee]/50 focus:outline-none resize-none"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`text-left rounded-lg border px-3 py-3 transition-colors ${
                template === t.id
                  ? "border-[#22d3ee]/50 bg-[#22d3ee]/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              }`}
            >
              <p className="text-[13px] font-semibold text-slate-100">{t.label}</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{t.bestFor}</p>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={createPage}
          disabled={creating}
          className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#06121a] hover:bg-[#22d3ee]/90 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create a landing page"}
        </button>
      </div>

      {/* Page list */}
      {pages.length === 0 ? (
        <AppEmptyState copy={LANDING_PAGE.empty} />
      ) : (
        <div className="flex flex-col gap-3">
          {pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              canBuild={canBuild}
              busy={busyId === page.id}
              onBuild={() => build(page.id)}
              onAttachDomain={(d) => attachDomain(page.id, d)}
              onRemove={() => remove(page.id)}
            />
          ))}
          {/* Part 7U: contextual PA Publish add-on prompt once the owner has a page to publish. */}
          <AddonPrompt kind="pa_publish" />
        </div>
      )}
    </div>
  );
}

function PageRow({
  page,
  canBuild,
  busy,
  onBuild,
  onAttachDomain,
  onRemove,
}: {
  page: LandingPageView;
  canBuild: boolean;
  busy: boolean;
  onBuild: () => void;
  onAttachDomain: (domain: string) => void;
  onRemove: () => void;
}) {
  const [domain, setDomain] = useState("");
  const canStart = canBuild && (page.status === "planning" || page.status === "failed");

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{page.title}</p>
          <p className="text-[13px] text-slate-400 mt-0.5 line-clamp-2">{page.description}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${statusClass(page.status)}`}
        >
          {STATUS_LABEL[page.status]}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {page.brainScope && (
          <p className="text-[10px] font-mono text-slate-600">scope: {page.brainScope}</p>
        )}
        {page.hasDesignSystem && (
          <span className="text-[10px] font-mono text-[#22d3ee]/70 border border-[#22d3ee]/20 rounded px-1 py-0.5">
            DS
          </span>
        )}
      </div>
      <p className="text-[11px] font-mono text-slate-500 mt-2">{STEP_LABEL[page.buildStep]}</p>

      {page.vercelUrl && (
        <a
          href={page.vercelUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[13px] text-[#22d3ee] hover:underline font-mono"
        >
          {page.customDomain ? `https://${page.customDomain}` : page.vercelUrl} →
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canStart && (
          <button
            type="button"
            onClick={onBuild}
            disabled={busy}
            className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-[13px] font-semibold text-[#06121a] hover:bg-[#22d3ee]/90 disabled:opacity-50"
          >
            {busy ? "Starting…" : page.status === "failed" ? "Retry build" : "Build it"}
          </button>
        )}
        {page.status === "live" && (
          <div className="flex items-center gap-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="get.yourdomain.com"
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-[13px] text-slate-100 placeholder-slate-600 focus:border-[#22d3ee]/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => domain.trim() && onAttachDomain(domain.trim())}
              disabled={busy || !domain.trim()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[13px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
            >
              Connect a domain
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="ml-auto text-[12px] text-slate-600 hover:text-slate-400 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
