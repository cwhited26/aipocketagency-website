"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Mascot from "@/components/Mascot";
import { WORLD, seedPositions, stepSimulation } from "@/lib/brain/force-sim";
import type { FolderGraph, FolderNode, BrainFileType } from "@/lib/brain/graph-folders";

// ── File-type colors / labels ─────────────────────────────────────────────────

const TYPE_COLOR: Record<BrainFileType, string> = {
  markdown: "#60a5fa",
  json: "#34d399",
  yaml: "#f59e0b",
  text: "#a78bfa",
  data: "#22d3ee",
  pdf: "#fb7185",
  image: "#f472b6",
  other: "#94a3b8",
};
const FOLDER_COLOR = "#64748b";

const TYPE_LABEL: Record<BrainFileType, string> = {
  markdown: "Notes",
  json: "JSON",
  yaml: "Config",
  text: "Text",
  data: "Tables",
  pdf: "PDFs",
  image: "Images",
  other: "Other",
};

function colorFor(node: FolderNode): string {
  return node.kind === "folder" ? FOLDER_COLOR : TYPE_COLOR[node.fileType ?? "other"];
}

// ── Recency ───────────────────────────────────────────────────────────────────

type Recency = "all" | "d30" | "d90" | "undated";

const RECENCY_LABEL: Record<Recency, string> = {
  all: "Any time",
  d30: "Last 30 days",
  d90: "Last 90 days",
  undated: "Undated",
};

// Days between a YYYY-MM-DD date string and now; null if unparseable.
function daysSince(date: string | null, now: number): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

// ── Layout types ─────────────────────────────────────────────────────────────

type SimNode = FolderNode & { x: number; y: number; vx: number; vy: number };

function radiusFor(node: FolderNode): number {
  if (node.id === "(root)") return 14;
  const base = node.kind === "folder" ? 9 : 6;
  const fromChildren = node.kind === "folder" ? Math.min(8, Math.sqrt(node.childCount) * 2) : 0;
  return base + fromChildren + Math.min(6, Math.sqrt(node.degree) * 1.3);
}

// ── Folders view ──────────────────────────────────────────────────────────────
// The structural graph: top-level folders and the key files inside them, wired by
// folder containment + [[wikilink]] cross-references. Filterable by folder, file
// type, and recency; collapses to a grouped list on narrow screens.

export default function FolderView({ brainRepo }: { brainRepo: string | null }) {
  const router = useRouter();
  const [graph, setGraph] = useState<FolderGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters.
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [recency, setRecency] = useState<Recency>("all");

  const [hovered, setHovered] = useState<string | null>(null);

  // Mobile → list fallback under 640px.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // A single "now" per mount keeps recency buckets stable across re-renders.
  const nowRef = useRef<number>(Date.now());

  // View transform + sim refs.
  const [view, setView] = useState({ zoom: 0.65, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const simRef = useRef<SimNode[]>([]);
  const alphaRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const [, setTick] = useState(0);
  const dragRef = useRef<{ id: string | null; moved: boolean } | null>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // ── Load graph ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!brainRepo) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch("/api/app/brain/graph?mode=folders")
      .then((r) =>
        r.ok ? (r.json() as Promise<FolderGraph>) : Promise.reject(new Error(`${r.status}`)),
      )
      .then((g) => {
        if (!alive) return;
        setGraph(g);
        simRef.current = seedPositions(g.nodes);
        alphaRef.current = 1;
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [brainRepo]);

  // ── Size tracking ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: Math.max(420, el.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, isNarrow]);

  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || !graph || size.w < 10 || isNarrow) return;
    didFit.current = true;
    const zoom = Math.min(size.w, size.h) / (WORLD * 1.05);
    setView({ zoom, x: size.w / 2 - (WORLD / 2) * zoom, y: size.h / 2 - (WORLD / 2) * zoom });
  }, [graph, size, isNarrow]);

  // ── Animation loop ────────────────────────────────────────────────────────────
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    (graph?.nodes ?? []).forEach((n, i) => m.set(n.id, i));
    return m;
  }, [graph]);

  useEffect(() => {
    if (!graph || isNarrow) return;
    const loop = () => {
      const nodes = simRef.current;
      if (alphaRef.current > 0.02) {
        for (let s = 0; s < 2; s++) {
          stepSimulation(nodes, graph.edges, indexById, alphaRef.current);
          alphaRef.current *= 0.985;
        }
        setTick((t) => t + 1);
      }
      const p = panRef.current;
      if (p && (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1)) {
        setView((v) => ({ ...v, x: v.x + p.vx, y: v.y + p.vy }));
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [graph, indexById, isNarrow]);

  const reheat = useCallback(() => {
    alphaRef.current = Math.max(alphaRef.current, 0.5);
  }, []);

  const toScreen = useCallback(
    (x: number, y: number) => ({ x: x * view.zoom + view.x, y: y * view.zoom + view.y }),
    [view],
  );

  // ── Filter predicate ──────────────────────────────────────────────────────────
  // Folders are structure — they pass the type + recency filters always, so the
  // tree never loses its skeleton; only files are narrowed by type/recency.
  const passes = useCallback(
    (n: FolderNode): boolean => {
      if (n.id === "(root)") return true;
      if (folderFilter !== "all" && n.topFolder !== folderFilter) return false;
      if (n.kind === "folder") return true;
      if (typeFilter !== "all" && n.fileType !== typeFilter) return false;
      if (recency !== "all") {
        const d = daysSince(n.date, nowRef.current);
        if (recency === "undated" && d !== null) return false;
        if (recency === "d30" && (d === null || d > 30)) return false;
        if (recency === "d90" && (d === null || d > 90)) return false;
      }
      return true;
    },
    [folderFilter, typeFilter, recency],
  );

  const shownIds = useMemo(() => {
    if (!graph) return new Set<string>();
    return new Set(graph.nodes.filter(passes).map((n) => n.id));
  }, [graph, passes]);

  // ── Pointer handlers ───────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const zoom = Math.min(4, Math.max(0.15, v.zoom * factor));
      return { zoom, x: mx - ((mx - v.x) / v.zoom) * zoom, y: my - ((my - v.y) / v.zoom) * zoom };
    });
  }, []);

  const onPointerDownBg = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 };
    dragRef.current = null;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.id) {
        const sim = simRef.current.find((s) => s.id === drag.id);
        if (sim) {
          sim.x += e.movementX / view.zoom;
          sim.y += e.movementY / view.zoom;
          sim.vx = 0;
          sim.vy = 0;
          drag.moved = true;
          reheat();
        }
        return;
      }
      const p = panRef.current;
      if (p) {
        p.vx = e.movementX;
        p.vy = e.movementY;
        setView((v) => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
      }
    },
    [view.zoom, reheat],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setTimeout(() => {
      panRef.current = null;
    }, 400);
  }, []);

  // ── Node activation: file drills to Documents, folder drills the folder filter ──
  const activate = useCallback(
    (node: FolderNode) => {
      if (node.id === "(root)") {
        setFolderFilter("all");
        return;
      }
      if (node.kind === "folder") {
        setFolderFilter((f) => (f === node.topFolder ? "all" : node.topFolder));
        return;
      }
      if (node.path) router.push(`/app/documents?path=${encodeURIComponent(node.path)}`);
    },
    [router],
  );

  const onNodePointerDown = useCallback((e: React.PointerEvent, node: FolderNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: node.id, moved: false };
    panRef.current = null;
  }, []);

  const onNodePointerUp = useCallback(
    (e: React.PointerEvent, node: FolderNode) => {
      e.stopPropagation();
      const drag = dragRef.current;
      if (!drag?.moved) activate(node);
      dragRef.current = null;
    },
    [activate],
  );

  const hoveredNode = useMemo(
    () => (hovered && graph ? graph.nodes.find((n) => n.id === hovered) ?? null : null),
    [hovered, graph],
  );

  // ── Loading / error ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Mascot state="working" size={88} />
        <p className="text-[12px] font-mono text-slate-500">reading your brain…</p>
      </div>
    );
  }
  if (error || !graph) {
    return (
      <p className="text-sm text-red-400 py-12 text-center">
        Could not load your folder map. {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400 leading-relaxed">
        Your brain, laid out the way it&apos;s stored — folders and the key files inside them, with
        a line drawn wherever one note points to another. Tap a file to open it; tap a folder to
        focus on just what&apos;s inside.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label="Folder"
          value={folderFilter}
          onChange={setFolderFilter}
          options={[
            { value: "all", label: "All folders" },
            ...graph.topFolders.map((f) => ({ value: f, label: f === "(root)" ? "Top level" : f })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All types" },
            ...graph.fileTypes.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
          ]}
        />
        <FilterSelect
          label="When"
          value={recency}
          onChange={(v) => setRecency(v as Recency)}
          options={(["all", "d30", "d90", "undated"] as Recency[]).map((r) => ({
            value: r,
            label: RECENCY_LABEL[r],
          }))}
        />
        {(folderFilter !== "all" || typeFilter !== "all" || recency !== "all") && (
          <button
            onClick={() => {
              setFolderFilter("all");
              setTypeFilter("all");
              setRecency("all");
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1.5"
          >
            Clear
          </button>
        )}
      </div>

      {isNarrow ? (
        <FolderListView graph={graph} shownIds={shownIds} />
      ) : (
        <div
          ref={containerRef}
          className="relative w-full rounded-2xl border border-slate-700/60 bg-[#080c12] overflow-hidden touch-none select-none"
          style={{ height: "62vh", minHeight: 440 }}
          onWheel={onWheel}
          onPointerDown={onPointerDownBg}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
            <ZoomBtn label="+" onClick={() => setView((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.25) }))} />
            <ZoomBtn label="−" onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.15, v.zoom / 1.25) }))} />
          </div>

          <TypeLegend types={graph.fileTypes} />

          {/* SVG */}
          <svg width={size.w} height={size.h} className="block">
            <g>
              {graph.edges.map((e, i) => {
                const a = simRef.current.find((s) => s.id === e.source);
                const b = simRef.current.find((s) => s.id === e.target);
                if (!a || !b) return null;
                const pa = toScreen(a.x, a.y);
                const pb = toScreen(b.x, b.y);
                const dim = !shownIds.has(e.source) || !shownIds.has(e.target);
                const lit = hovered === e.source || hovered === e.target;
                return (
                  <line
                    key={i}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={lit ? "#22d3ee" : e.kind === "wikilink" ? "#475569" : "#334155"}
                    strokeOpacity={dim ? 0.05 : lit ? 0.7 : 0.3}
                    strokeWidth={lit ? 1.4 : 0.8}
                    strokeDasharray={e.kind === "wikilink" ? "3 3" : undefined}
                  />
                );
              })}
              {simRef.current.map((n) => {
                const p = toScreen(n.x, n.y);
                const r = radiusFor(n) * Math.min(1.6, Math.max(0.7, view.zoom));
                const shown = shownIds.has(n.id);
                const isFolder = n.kind === "folder";
                const showLabel =
                  hovered === n.id ||
                  (shown && (isFolder || n.isKey || view.zoom > 1.15));
                return (
                  <g key={n.id} opacity={shown ? 1 : 0.12} style={{ cursor: "pointer" }}>
                    {isFolder ? (
                      <rect
                        x={p.x - r}
                        y={p.y - r}
                        width={r * 2}
                        height={r * 2}
                        rx={r * 0.4}
                        fill={FOLDER_COLOR}
                        fillOpacity={0.85}
                        stroke={n.id === "(root)" ? "#e2e8f0" : "#0b1017"}
                        strokeWidth={n.id === "(root)" ? 2 : 1}
                        onPointerDown={(e) => onNodePointerDown(e, n)}
                        onPointerUp={(e) => onNodePointerUp(e, n)}
                        onPointerEnter={() => setHovered(n.id)}
                        onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                      />
                    ) : (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={r}
                        fill={colorFor(n)}
                        fillOpacity={0.9}
                        stroke={n.isKey ? "#f1f5f9" : "#0b1017"}
                        strokeWidth={n.isKey ? 2 : 1}
                        onPointerDown={(e) => onNodePointerDown(e, n)}
                        onPointerUp={(e) => onNodePointerUp(e, n)}
                        onPointerEnter={() => setHovered(n.id)}
                        onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                      />
                    )}
                    {showLabel && (
                      <text
                        x={p.x}
                        y={p.y - r - 4}
                        textAnchor="middle"
                        fontSize={11}
                        fill={isFolder ? "#cbd5e1" : "#94a3b8"}
                        className="pointer-events-none font-medium"
                        style={{ paintOrder: "stroke", stroke: "#080c12", strokeWidth: 3 }}
                      >
                        {n.label.length > 28 ? `${n.label.slice(0, 28)}…` : n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Hover excerpt card */}
          {hoveredNode &&
            (() => {
              const sim = simRef.current.find((s) => s.id === hoveredNode.id);
              if (!sim) return null;
              const p = toScreen(sim.x, sim.y);
              const left = Math.min(Math.max(p.x + 14, 8), Math.max(8, size.w - 248));
              const top = Math.min(Math.max(p.y + 14, 8), Math.max(8, size.h - 96));
              return (
                <div
                  className="absolute z-30 w-60 rounded-lg border border-slate-700/70 bg-[#0b1017]/95 backdrop-blur px-3 py-2 pointer-events-none shadow-xl"
                  style={{ left, top }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: colorFor(hoveredNode) }}
                    />
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {hoveredNode.label}
                    </span>
                    {hoveredNode.isKey && (
                      <span className="text-[9px] font-mono uppercase tracking-wide text-amber-300/80">
                        key
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {hoveredNode.excerpt}
                  </p>
                  <p className="text-[10px] font-mono text-slate-600 mt-1">
                    {hoveredNode.kind === "folder"
                      ? `${hoveredNode.childCount} inside`
                      : hoveredNode.path}
                  </p>
                </div>
              );
            })()}

          <p className="absolute bottom-2 left-3 z-10 text-[10px] font-mono text-slate-600 pointer-events-none">
            drag to pan · scroll to zoom · tap a file to open it
          </p>
        </div>
      )}
    </div>
  );
}

// ── Mobile list fallback ───────────────────────────────────────────────────────

function FolderListView({
  graph,
  shownIds,
}: {
  graph: FolderGraph;
  shownIds: Set<string>;
}) {
  // Group the shown files by their top-level folder.
  const groups = useMemo(() => {
    const byFolder = new Map<string, FolderNode[]>();
    for (const n of graph.nodes) {
      if (n.kind !== "file" || !shownIds.has(n.id)) continue;
      const key = n.topFolder === "(root)" ? "Top level" : n.topFolder;
      const arr = byFolder.get(key) ?? [];
      arr.push(n);
      byFolder.set(key, arr);
    }
    return [...byFolder.entries()]
      .map(([folder, files]) => ({
        folder,
        files: files.sort((a, b) => Number(b.isKey) - Number(a.isKey) || a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.folder.localeCompare(b.folder));
  }, [graph, shownIds]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">
        Nothing matches those filters yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ folder, files }) => (
        <div key={folder} className="rounded-2xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/60">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: FOLDER_COLOR }} />
            <span className="text-xs font-semibold text-slate-200">{folder}</span>
            <span className="text-[10px] font-mono text-slate-500">{files.length}</span>
          </div>
          <ul className="divide-y divide-slate-800/40">
            {files.map((f) => (
              <li key={f.id}>
                <a
                  href={f.path ? `/app/documents?path=${encodeURIComponent(f.path)}` : "#"}
                  className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-800/40 transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: colorFor(f) }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-200 truncate">{f.label}</span>
                      {f.isKey && (
                        <span className="text-[9px] font-mono uppercase tracking-wide text-amber-300/80 shrink-0">
                          key
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-500 leading-snug line-clamp-2 mt-0.5">
                      {f.excerpt}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Small components ───────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-2.5 py-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0b1017] text-slate-200">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TypeLegend({ types }: { types: BrainFileType[] }) {
  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-slate-700/60 bg-[#0b1017]/85 backdrop-blur px-3 py-2 flex flex-col gap-1 max-w-[44%]">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: FOLDER_COLOR }} />
        <span className="text-[10px] text-slate-400">folders</span>
      </div>
      {types.map((t) => (
        <div key={t} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLOR[t] }} />
          <span className="text-[10px] text-slate-400">{TYPE_LABEL[t].toLowerCase()}</span>
        </div>
      ))}
    </div>
  );
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-lg border border-slate-700/70 bg-[#0b1017]/90 backdrop-blur text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 transition-colors text-lg leading-none flex items-center justify-center"
      aria-label={label === "+" ? "Zoom in" : "Zoom out"}
    >
      {label}
    </button>
  );
}
