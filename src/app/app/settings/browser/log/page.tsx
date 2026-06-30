// /app/settings/browser/log — the Browser Automation audit log (prompt item 6). Server component:
// resolves the owner, reads pa_browser_actions newest-first (optionally filtered by domain / persona /
// status via the query string), signs a fresh screenshot URL per row, and renders the table with
// thumbnails. Read-only — the source of truth is the table; nothing here mutates.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listBrowserActions, type BrowserActionRow } from "@/lib/browser/actions-db";
import { signScreenshotUrl } from "@/lib/browser/screenshots";
import { BROWSER_ACTION_STATUSES, type BrowserActionStatus } from "@/lib/browser/constants";

export const dynamic = "force-dynamic";

type SearchParams = { domain?: string; persona?: string; status?: string };

function parseStatus(raw: string | undefined): BrowserActionStatus | undefined {
  if (raw && (BROWSER_ACTION_STATUSES as readonly string[]).includes(raw)) return raw as BrowserActionStatus;
  return undefined;
}

const STATUS_STYLES: Record<BrowserActionStatus, string> = {
  executed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending_approval: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  refused: "bg-red-500/15 text-red-300 border-red-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
  rejected: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  failed: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export default async function BrowserActionLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const status = parseStatus(searchParams.status);
  const list = await listBrowserActions(user.id, {
    domain: searchParams.domain?.trim() || undefined,
    personaId: searchParams.persona?.trim() || undefined,
    status,
    limit: 200,
  });

  const rows: BrowserActionRow[] = list.ok ? list.data : [];
  // Sign a fresh short-lived URL for each stored screenshot (the stored value is the object path).
  const signedByRow = new Map<string, string>();
  await Promise.all(
    rows
      .filter((r) => r.screenshot_url)
      .map(async (r) => {
        const url = await signScreenshotUrl(r.screenshot_url as string);
        if (url) signedByRow.set(r.id, url);
      }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/app/settings" className="text-xs font-mono text-[#22d3ee]/80 hover:text-[#22d3ee]">
          ← Settings
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">Browser action log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every action your agent took in the hidden browser — refused, blocked, awaiting approval, or run.
          Newest first.
        </p>
      </div>

      {/* Status filter chips. Domain / persona filters come in via the query string. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterChip label="All" href={hrefWith(searchParams, { status: undefined })} active={!status} />
        {BROWSER_ACTION_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s.replace("_", " ")}
            href={hrefWith(searchParams, { status: s })}
            active={status === s}
          />
        ))}
      </div>

      {!list.ok && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Could not load the log: {list.error}
        </p>
      )}

      {list.ok && rows.length === 0 && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-8 text-center text-sm text-slate-400">
          No browser actions yet. When your agent uses the browser, every action shows up here.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const signed = signedByRow.get(row.id);
          return (
            <div
              key={row.id}
              className="flex gap-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4"
            >
              {signed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signed}
                  alt={`Screenshot for ${row.action}`}
                  className="h-16 w-24 flex-shrink-0 rounded-md border border-slate-700/60 object-cover"
                />
              ) : (
                <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-md border border-slate-800/60 bg-slate-950/40 text-[10px] text-slate-600">
                  no shot
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-200">{row.action}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLES[row.status]}`}
                  >
                    {row.status.replace("_", " ")}
                  </span>
                </div>
                {row.target_url && (
                  <p className="mt-1 truncate text-xs text-slate-400">{row.target_url}</p>
                )}
                {row.selector && (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{row.selector}</p>
                )}
                {row.error && <p className="mt-1 text-xs text-red-300/90">{row.error}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                  {row.domain && <span>domain: {row.domain}</span>}
                  <span>{new Date(row.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function hrefWith(current: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();
  if (merged.domain) params.set("domain", merged.domain);
  if (merged.persona) params.set("persona", merged.persona);
  if (merged.status) params.set("status", merged.status);
  const qs = params.toString();
  return qs ? `/app/settings/browser/log?${qs}` : "/app/settings/browser/log";
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }): JSX.Element {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
        active
          ? "border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#22d3ee]"
          : "border-slate-700/60 text-slate-400 hover:border-slate-600"
      }`}
    >
      {label}
    </Link>
  );
}
