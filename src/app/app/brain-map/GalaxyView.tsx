"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mascot from "@/components/Mascot";
import { WORLD, seedPositions, stepSimulation } from "@/lib/brain/force-sim";
import type {
  BrainGraph,
  BrainNode,
  KnowledgeArea,
} from "@/lib/brain/graph";

// ── Area colors / labels ─────────────────────────────────────────────────────

const AREA_COLOR: Record<KnowledgeArea, string> = {
  voice: "#a78bfa",
  customers: "#22d3ee",
  tools: "#34d399",
  decisions: "#f59e0b",
  "standing-rules": "#f472b6",
  business: "#60a5fa",
  competitive: "#fb7185",
};

const AREA_BLURB: Record<KnowledgeArea, string> = {
  voice: "voice influences",
  customers: "customers & people",
  tools: "tools & connectors",
  decisions: "decisions & projects",
  "standing-rules": "standing rules",
  business: "facts about the business",
  competitive: "competitive notes",
};

// ── Layout types ─────────────────────────────────────────────────────────────

type SimNode = BrainNode & { x: number; y: number; vx: number; vy: number };

type FileContentResponse = { path: string; content: string; kind: string };

function radiusFor(node: BrainNode): number {
  const base = node.type === "memory" || node.type === "competitive" ? 7 : 9;
  return base + Math.min(11, Math.sqrt(node.degree) * 2.4);
}

// ── Galaxy view ──────────────────────────────────────────────────────────────
// The semantic-category graph: nodes grouped by what they mean (voice, customers,
// tools, decisions), plus the knowledge-area strip and the "what PA doesn't know"
// gap panel. The default Brain Map view.

export default function GalaxyView({ brainRepo }: { brainRepo: string | null }) {
  const [graph, setGraph] = useState<BrainGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<BrainNode | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // View transform.
  const [view, setView] = useState({ zoom: 0.65, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  // Simulation state lives in refs; a tick counter drives re-render.
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
    fetch("/api/app/brain/graph")
      .then((r) =>
        r.ok ? (r.json() as Promise<BrainGraph>) : Promise.reject(new Error(`${r.status}`)),
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
    const update = () =>
      setSize({ w: el.clientWidth, h: Math.max(420, el.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // Fit the layout into view once we know both the graph and the canvas size.
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || !graph || size.w < 10) return;
    didFit.current = true;
    const zoom = Math.min(size.w, size.h) / (WORLD * 1.05);
    setView({ zoom, x: size.w / 2 - (WORLD / 2) * zoom, y: size.h / 2 - (WORLD / 2) * zoom });
  }, [graph, size]);

  // ── Animation loop ────────────────────────────────────────────────────────────
  // Index matches simRef order — seedPositions maps graph.nodes 1:1 — so we build
  // it straight from graph.nodes (rebuilt whenever a new graph loads).
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    (graph?.nodes ?? []).forEach((n, i) => m.set(n.id, i));
    return m;
  }, [graph]);

  useEffect(() => {
    if (!graph) return;
    const loop = () => {
      const nodes = simRef.current;
      if (alphaRef.current > 0.02) {
        for (let s = 0; s < 2; s++) {
          stepSimulation(nodes, graph.edges, indexById, alphaRef.current);
          alphaRef.current *= 0.985;
        }
        setTick((t) => t + 1);
      }
      // Pan inertia after a flick.
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
  }, [graph, indexById]);

  const reheat = useCallback(() => {
    alphaRef.current = Math.max(alphaRef.current, 0.5);
  }, []);

  // ── Coordinate transforms ──────────────────────────────────────────────────────
  const toScreen = useCallback(
    (x: number, y: number) => ({ x: x * view.zoom + view.x, y: y * view.zoom + view.y }),
    [view],
  );

  const centerOn = useCallback(
    (node: BrainNode) => {
      const sim = simRef.current.find((s) => s.id === node.id);
      if (!sim) return;
      const zoom = Math.max(view.zoom, 1.1);
      setView({ zoom, x: size.w / 2 - sim.x * zoom, y: size.h / 2 - sim.y * zoom });
    },
    [view.zoom, size],
  );

  // ── Pointer handlers ───────────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const zoom = Math.min(4, Math.max(0.15, v.zoom * factor));
        // Keep the point under the cursor stationary.
        return {
          zoom,
          x: mx - ((mx - v.x) / v.zoom) * zoom,
          y: my - ((my - v.y) / v.zoom) * zoom,
        };
      });
    },
    [],
  );

  const onPointerDownBg = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 };
    dragRef.current = null;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
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
  }, [view.zoom, reheat]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    // panRef inertia is consumed by the rAF loop, then cleared.
    setTimeout(() => {
      panRef.current = null;
    }, 400);
  }, []);

  const onNodePointerDown = useCallback((e: React.PointerEvent, node: BrainNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: node.id, moved: false };
    panRef.current = null;
  }, []);

  const onNodePointerUp = useCallback(
    (e: React.PointerEvent, node: BrainNode) => {
      e.stopPropagation();
      const drag = dragRef.current;
      if (!drag?.moved) {
        setSelected(node);
        centerOn(node);
      }
      dragRef.current = null;
    },
    [centerOn],
  );

  // ── Search ──────────────────────────────────────────────────────────────────
  const lc = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!graph || !lc) return new Set<string>();
    const m = new Set<string>();
    for (const n of graph.nodes) {
      if (n.label.toLowerCase().includes(lc) || n.summary.toLowerCase().includes(lc)) {
        m.add(n.id);
      }
    }
    return m;
  }, [graph, lc]);

  const searchResults = useMemo(
    () => (graph && lc ? graph.nodes.filter((n) => matches.has(n.id)).slice(0, 8) : []),
    [graph, lc, matches],
  );

  // Neighbors of the selected node, for highlighting + the panel's "connections".
  const neighborIds = useMemo(() => {
    if (!graph || !selected) return new Set<string>();
    const s = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === selected.id) s.add(e.target);
      if (e.target === selected.id) s.add(e.source);
    }
    return s;
  }, [graph, selected]);

  // ── Loading / error states ────────────────────────────────────────────────────
  if (loading) {
    return (
      <Frame>
        <div className="flex flex-col items-center gap-3 py-20">
          <Mascot state="working" size={88} />
          <p className="text-[12px] font-mono text-slate-500">reading your brain…</p>
        </div>
      </Frame>
    );
  }

  if (error || !graph) {
    return (
      <Frame>
        <p className="text-sm text-red-400 py-12 text-center">
          Could not load your brain map. {error}
        </p>
      </Frame>
    );
  }

  const visibleAreas = graph.areas.filter((a) => a.count > 0);

  return (
    <Frame>
      {/* Knowledge-area strip */}
      <KnowledgeStrip areas={graph.areas} nodeCount={graph.nodes.length} />

      {/* Gaps */}
      <GapsPanel gaps={graph.gaps} />

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl border border-slate-700/60 bg-[#080c12] overflow-hidden touch-none select-none"
        style={{ height: "62vh", minHeight: 440 }}
        onWheel={onWheel}
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Search overlay */}
        <div className="absolute top-3 left-3 z-20 w-[min(320px,calc(100%-1.5rem))]">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-[#0b1017]/90 backdrop-blur px-3 py-2">
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search what PA knows…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1.5 rounded-lg border border-slate-700/70 bg-[#0b1017]/95 backdrop-blur overflow-hidden">
              {searchResults.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setSelected(n);
                    centerOn(n);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/50 transition-colors border-b border-slate-800/40 last:border-b-0"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: AREA_COLOR[n.area] }}
                  />
                  <span className="text-xs text-slate-200 truncate">{n.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
          <ZoomBtn label="+" onClick={() => setView((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.25) }))} />
          <ZoomBtn label="−" onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.15, v.zoom / 1.25) }))} />
        </div>

        {/* Legend */}
        <Legend areas={visibleAreas.map((a) => a.area)} />

        {/* SVG */}
        <svg width={size.w} height={size.h} className="block">
          <g>
            {graph.edges.map((e, i) => {
              const a = simRef.current.find((s) => s.id === e.source);
              const b = simRef.current.find((s) => s.id === e.target);
              if (!a || !b) return null;
              const pa = toScreen(a.x, a.y);
              const pb = toScreen(b.x, b.y);
              const lit =
                (selected && (e.source === selected.id || e.target === selected.id)) ||
                (hovered && (e.source === hovered || e.target === hovered));
              return (
                <line
                  key={i}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={lit ? "#22d3ee" : "#334155"}
                  strokeOpacity={lit ? 0.7 : selected || hovered ? 0.12 : 0.28}
                  strokeWidth={lit ? 1.4 : 0.8}
                  strokeDasharray={e.kind === "supersede" ? "3 3" : undefined}
                />
              );
            })}
            {simRef.current.map((n) => {
              const p = toScreen(n.x, n.y);
              const r = radiusFor(n) * Math.min(1.6, Math.max(0.7, view.zoom));
              const isSel = selected?.id === n.id;
              const isNeighbor = neighborIds.has(n.id);
              const isMatch = matches.has(n.id);
              const dim =
                (selected && !isSel && !isNeighbor) || (lc.length > 0 && !isMatch);
              const showLabel =
                isSel ||
                hovered === n.id ||
                isMatch ||
                (!dim &&
                  (view.zoom > 1.1 ||
                    n.type === "voice" ||
                    n.type === "customer" ||
                    n.type === "tool" ||
                    n.degree >= 4));
              return (
                <g key={n.id} opacity={dim ? 0.18 : 1} style={{ cursor: "pointer" }}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={AREA_COLOR[n.area]}
                    fillOpacity={n.superseded ? 0.32 : 0.9}
                    stroke={isSel ? "#e2e8f0" : isMatch ? "#22d3ee" : "#0b1017"}
                    strokeWidth={isSel || isMatch ? 2 : 1}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                    onPointerUp={(e) => onNodePointerUp(e, n)}
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                  />
                  {showLabel && (
                    <text
                      x={p.x}
                      y={p.y - r - 4}
                      textAnchor="middle"
                      fontSize={11}
                      fill={isSel ? "#f1f5f9" : "#94a3b8"}
                      className="pointer-events-none font-medium"
                      style={{ paintOrder: "stroke", stroke: "#080c12", strokeWidth: 3 }}
                    >
                      {n.label.length > 26 ? `${n.label.slice(0, 26)}…` : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <p className="absolute bottom-2 left-3 z-10 text-[10px] font-mono text-slate-600 pointer-events-none">
          drag to pan · scroll to zoom · tap a node to inspect
        </p>
      </div>

      {/* Inspection panel */}
      {selected && (
        <InspectPanel
          node={selected}
          graph={graph}
          onClose={() => setSelected(null)}
          onPick={(node) => {
            setSelected(node);
            centerOn(node);
          }}
        />
      )}
    </Frame>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function KnowledgeStrip({
  areas,
  nodeCount,
}: {
  areas: BrainGraph["areas"];
  nodeCount: number;
}) {
  const get = (a: KnowledgeArea) => areas.find((x) => x.area === a)?.count ?? 0;
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-4">
      <p className="text-sm text-slate-300 leading-relaxed mb-3">
        Your agent is holding{" "}
        <span className="text-slate-100 font-semibold">{nodeCount}</span> connected things about
        your business —{" "}
        <span className="text-[#a78bfa] font-semibold">{get("voice")}</span> on your voice,{" "}
        <span className="text-[#22d3ee] font-semibold">{get("customers")}</span> people and
        customers,{" "}
        <span className="text-[#f59e0b] font-semibold">{get("decisions")}</span> decisions, and{" "}
        <span className="text-[#f472b6] font-semibold">{get("standing-rules")}</span> standing
        rules it follows.
      </p>
      <div className="flex flex-wrap gap-2">
        {areas
          .filter((a) => a.count > 0)
          .map((a) => (
            <div
              key={a.area}
              className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-2.5 py-1.5"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: AREA_COLOR[a.area] }}
              />
              <span className="text-xs text-slate-300">{a.label}</span>
              <span className="text-xs font-mono text-slate-500">{a.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function GapsPanel({ gaps }: { gaps: BrainGraph["gaps"] }) {
  const [open, setOpen] = useState(true);
  if (gaps.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <p className="text-sm text-emerald-300/90">
          <span className="font-semibold">Solid coverage.</span> Your agent has voice, customers,
          decisions, and rules on file. Keep feeding it and the map keeps getting richer.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-amber-500/5 transition-colors"
      >
        <span className="text-amber-300 text-sm">⚠</span>
        <span className="text-sm font-semibold text-amber-200 flex-1">
          What PA doesn&apos;t know yet ({gaps.length})
        </span>
        <span className="text-[10px] font-mono text-amber-300/60">
          {open ? "hide" : "show"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {gaps.map((g) => (
            <div key={g.area} className="flex items-start gap-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300/70 mt-0.5 shrink-0 w-24">
                {g.area}
              </span>
              <p className="text-sm text-slate-300 leading-snug flex-1">{g.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InspectPanel({
  node,
  graph,
  onClose,
  onPick,
}: {
  node: BrainNode;
  graph: BrainGraph;
  onClose: () => void;
  onPick: (n: BrainNode) => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const isDoc =
    (node.type === "memory" || node.type === "competitive") &&
    !!node.path &&
    /\.mdx?$/i.test(node.path);

  useEffect(() => {
    if (!isDoc || !node.path) {
      setContent(null);
      return;
    }
    setLoadingContent(true);
    setContent(null);
    fetch(`/api/app/brain/file?path=${encodeURIComponent(node.path)}`)
      .then((r) =>
        r.ok ? (r.json() as Promise<FileContentResponse>) : Promise.reject(new Error(`${r.status}`)),
      )
      .then((d) => setContent(d.content))
      .catch(() => setContent(null))
      .finally(() => setLoadingContent(false));
  }, [node.path, isDoc]);

  // Outgoing references + every neighbor, resolved to nodes.
  const byId = useMemo(() => {
    const m = new Map<string, BrainNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph]);

  const connections = useMemo(() => {
    const ids = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === node.id) ids.add(e.target);
      if (e.target === node.id) ids.add(e.source);
    }
    return [...ids].map((id) => byId.get(id)).filter((n): n is BrainNode => !!n);
  }, [graph, node.id, byId]);

  const typeLabel: Record<BrainNode["type"], string> = {
    memory: "Memory entry",
    voice: "Voice influence",
    customer: "Customer / person",
    tool: "Tool / connector",
    competitive: "Competitive intel",
  };

  return (
    <div
      className="fixed inset-0 z-50 lg:bg-transparent bg-black/50 lg:pointer-events-none"
      onClick={onClose}
    >
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0b1017] border-l border-slate-700/70 shadow-2xl flex flex-col lg:pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-800/60 shrink-0">
          <span
            className="w-3 h-3 rounded-full mt-1 shrink-0"
            style={{ background: AREA_COLOR[node.area] }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 leading-snug">{node.label}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              {typeLabel[node.type]}
              {node.date ? ` · ${node.date}` : ""}
              {node.superseded ? " · superseded" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 shrink-0"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 flex flex-col gap-4">
          {node.superseded && (
            <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 px-3 py-2">
              <p className="text-[11px] text-slate-400">
                A newer note has replaced this one. Your agent keeps it for history but leans on the
                newer version.
              </p>
            </div>
          )}

          {/* Summary */}
          {node.summary && !content && (
            <p className="text-sm text-slate-300 leading-relaxed">{node.summary}</p>
          )}

          {/* Full document for memory / competitive nodes */}
          {isDoc &&
            (loadingContent ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee]/60 animate-pulse" />
                Loading…
              </div>
            ) : content ? (
              <div className="prose-brain">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : null)}

          {/* Connections */}
          {connections.length > 0 && (
            <div>
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                Connected to ({connections.length})
              </p>
              <div className="flex flex-col gap-1">
                {connections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPick(c)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: AREA_COLOR[c.area] }}
                    />
                    <span className="text-xs text-slate-300 truncate flex-1">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Open in Documents */}
        {isDoc && node.path && (
          <div className="px-5 py-3 border-t border-slate-800/50 shrink-0">
            <a
              href={`/app/documents?path=${encodeURIComponent(node.path)}`}
              className="text-sm font-mono text-[#22d3ee] hover:underline"
            >
              Open in Documents →
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}

function Legend({ areas }: { areas: KnowledgeArea[] }) {
  const order: KnowledgeArea[] = [
    "voice",
    "customers",
    "tools",
    "decisions",
    "standing-rules",
    "business",
    "competitive",
  ];
  const shown = order.filter((a) => areas.includes(a));
  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-slate-700/60 bg-[#0b1017]/85 backdrop-blur px-3 py-2 flex flex-col gap-1 max-w-[44%]">
      {shown.map((a) => (
        <div key={a} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: AREA_COLOR[a] }} />
          <span className="text-[10px] text-slate-400 capitalize">{AREA_BLURB[a]}</span>
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

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-600 shrink-0">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
