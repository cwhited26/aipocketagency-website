// Shared hand-rolled force-directed layout for the Brain Map.
//
// No graph library (none is in the dependency set, and the repo's convention is
// hand-rolled SVG like Mascot.tsx and the Cost tab charts). Both Brain Map modes
// — Galaxy (semantic) and Folders (structural) — drive the same simulation:
// pairwise repulsion + link springs + a pull to center, with cooling. Generic over
// any node carrying a position; edges reference nodes by string id.

export const WORLD = 1000; // virtual layout square; pan/zoom maps it to the viewport

export type Vec = { x: number; y: number; vx: number; vy: number };
export type SimEdge = { source: string; target: string };

export type SimParams = {
  charge: number; // repulsion strength
  linkDistance: number; // spring rest length
  linkStrength: number; // spring stiffness
  gravity: number; // pull toward center
  damping: number; // velocity retention per tick
};

// Defaults tuned for the Galaxy graph — kept here so Galaxy's behavior is byte-for
// behavior identical to its original inline simulation.
export const DEFAULT_PARAMS: SimParams = {
  charge: 2600,
  linkDistance: 90,
  linkStrength: 0.04,
  gravity: 0.012,
  damping: 0.82,
};

// Golden-angle spiral seed → deterministic, evenly spread, no RNG.
export function seedPositions<T>(nodes: T[]): (T & Vec)[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return nodes.map((n, i) => {
    const r = 40 + Math.sqrt(i) * 34;
    const a = i * golden;
    return {
      ...n,
      x: WORLD / 2 + Math.cos(a) * r,
      y: WORLD / 2 + Math.sin(a) * r,
      vx: 0,
      vy: 0,
    };
  });
}

export function stepSimulation(
  nodes: Vec[],
  edges: SimEdge[],
  indexById: Map<string, number>,
  alpha: number,
  params: SimParams = DEFAULT_PARAMS,
): void {
  const n = nodes.length;
  const { charge, linkDistance, linkStrength, gravity, damping } = params;
  // Pairwise repulsion. n is bounded (≤ ~400 nodes from the read cap), so O(n²)
  // per tick is cheap and the loop stops once the layout cools.
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = (i - j) * 0.5 + 0.1;
        dy = (i + j) * 0.3 + 0.1;
        d2 = dx * dx + dy * dy;
      }
      const force = (charge / d2) * alpha;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }
  // Link springs.
  for (const e of edges) {
    const si = indexById.get(e.source);
    const ti = indexById.get(e.target);
    if (si === undefined || ti === undefined) continue;
    const a = nodes[si];
    const b = nodes[ti];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = (d - linkDistance) * linkStrength * alpha;
    const fx = (dx / d) * k;
    const fy = (dy / d) * k;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }
  // Gravity to center + integrate + damping.
  for (const node of nodes) {
    node.vx += (WORLD / 2 - node.x) * gravity * alpha;
    node.vy += (WORLD / 2 - node.y) * gravity * alpha;
    node.x += node.vx;
    node.y += node.vy;
    node.vx *= damping;
    node.vy *= damping;
  }
}
