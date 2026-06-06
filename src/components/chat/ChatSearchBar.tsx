"use client";

// ChatSearchBar — sits under the chat header: substring search, date-range, source/type
// filter, and JSON/Markdown export. Controlled by the parent (ChatHome), which runs the
// actual search over the loaded history via lib/chat/search.

import { SEARCH_SOURCES, type SearchQuery, type SearchSource } from "@/lib/chat/search";
import { SearchIcon, DownloadIcon, CloseIcon } from "./icons";

const SOURCE_LABELS: Record<SearchSource, string> = {
  all: "All",
  memory: "Memory",
  persona: "Persona",
  doc: "Docs",
  voice: "Voice",
  screenshot: "Screenshots",
  general: "Chat",
};

export default function ChatSearchBar({
  query,
  onChange,
  onExport,
  resultCount,
  active,
  onClear,
}: {
  query: SearchQuery;
  onChange: (q: SearchQuery) => void;
  onExport: (format: "json" | "md") => void;
  resultCount: number | null;
  active: boolean;
  onClear: () => void;
}) {
  return (
    <div className="border-b border-slate-800/50 bg-[#070c11]/80 px-3 sm:px-4 py-2.5">
      <div className="max-w-2xl mx-auto flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="flex items-center gap-2 flex-1 min-w-[180px] rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-1.5">
            <span className="text-slate-500">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={query.text ?? ""}
              onChange={(e) => onChange({ ...query, text: e.target.value })}
              placeholder="Search chat history…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none"
            />
            {active && (
              <button onClick={onClear} aria-label="Clear search" className="text-slate-500 hover:text-slate-300">
                <CloseIcon />
              </button>
            )}
          </div>

          {/* Source filter */}
          <select
            value={query.source ?? "all"}
            onChange={(e) => onChange({ ...query, source: e.target.value as SearchSource })}
            className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-300 outline-none"
          >
            {SEARCH_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>

          {/* Export */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onExport("json")}
              title="Export as JSON"
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 px-2 py-1.5 text-[11px] font-mono text-slate-400 hover:text-[#22d3ee] hover:border-[#22d3ee]/40 transition-colors"
            >
              <DownloadIcon /> JSON
            </button>
            <button
              onClick={() => onExport("md")}
              title="Export as Markdown"
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 px-2 py-1.5 text-[11px] font-mono text-slate-400 hover:text-[#22d3ee] hover:border-[#22d3ee]/40 transition-colors"
            >
              <DownloadIcon /> MD
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-600">From</label>
          <input
            type="date"
            value={query.from ? query.from.slice(0, 10) : ""}
            onChange={(e) => onChange({ ...query, from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })}
            className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 outline-none"
          />
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-600">To</label>
          <input
            type="date"
            value={query.to ? query.to.slice(0, 10) : ""}
            onChange={(e) => onChange({ ...query, to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined })}
            className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 outline-none"
          />
          {resultCount !== null && (
            <span className="ml-auto text-[11px] font-mono text-slate-500">
              {resultCount} {resultCount === 1 ? "match" : "matches"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
