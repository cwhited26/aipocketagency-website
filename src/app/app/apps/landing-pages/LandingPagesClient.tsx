"use client";

import { useState } from "react";
import type { LandingPageView, TemplateId } from "@/lib/landing-pages/types";

type TemplateOption = { id: TemplateId; label: string; description: string; bestFor: string };

type Props = {
  initialPages: LandingPageView[];
  templates: TemplateOption[];
  canBuild: boolean;
  hasApiKey: boolean;
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

export default function LandingPagesClient({ initialPages, templates, canBuild, hasApiKey }: Props) {
  const [pages, setPages] = useState<LandingPageView[]>(initialPages);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<TemplateId>(templates[0]?.id ?? "single-cta");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createPage() {
    if (!title.trim() || !description.trim()) {
      setError("Give the page a name and tell PA what it's for.");
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/app/apps/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), template }),
      });
      const data = (await res.json()) as { page?: LandingPageView; message?: string; error?: string };
      if (!res.ok || !data.page) {
        setError(data.message ?? data.error ?? "Couldn't create the page.");
        return;
      }
      setPages((p) => [data.page as LandingPageView, ...p]);
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
            <a href="/app/settings/billing" className="text-[#22d3ee] hover:underline">
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

      {/* Create a page */}
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-5 mb-8">
        <p className="text-sm font-semibold text-slate-100 mb-3">Create a landing page</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name it — e.g. Roofing — free inspection"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 mb-3 focus:border-[#22d3ee]/50 focus:outline-none"
        />
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
        <p className="text-sm text-slate-500">No pages yet. Describe one above and PA drafts it.</p>
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
