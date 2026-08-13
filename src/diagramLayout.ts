// Diagram layout — computes child node positions for a Space's `arrangement`.
// Implemented: manual, grid, treemap (squarified), layered, tree, radial,
// pack, force, swimlane, timeline.
import { hierarchy, tree as d3tree, pack as d3pack } from 'd3-hierarchy';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import type { DiagramLayout, SceneNode, SceneRelation, ScaleDef } from './types.js';
import { resolveChannel } from './scale.js';

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function str(v: unknown, d: string): string {
  return typeof v === 'string' ? v : d;
}

export function computeDiagramLayout(
  layout: DiagramLayout,
  nodes: SceneNode[],
  scope: Record<string, unknown>,
  scales: Map<string, ScaleDef>,
  area: { width: number; height: number },
  relations: SceneRelation[] = [],
): Map<string, LayoutBox> {
  switch (layout.algorithm) {
    case 'treemap': return treemapLayout(nodes, layout, scope, scales, area);
    case 'pack': return packLayout(nodes, layout, scope, scales, area);
    case 'grid': return gridLayout(nodes, layout, area);
    case 'layered': return layeredLayout(nodes, relations, area, layout);
    case 'tree': return treeLayout(nodes, area, layout);
    case 'radial': return radialLayout(nodes, area, layout);
    case 'force': return forceLayout(nodes, relations, area, layout);
    case 'swimlane': return swimlaneLayout(nodes, layout, scope, scales, area);
    case 'timeline': return timelineLayout(nodes, layout, scope, scales, area);
    case 'manual': return manualLayout(nodes);
    default: return new Map();
  }
}

// ── Algorithms ──────────────────────────────────────────────────────────────

function manualLayout(nodes: SceneNode[]): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  for (const n of nodes) {
    const t = n.transform;
    const g = n.geometry as Record<string, unknown>;
    out.set(n.id, {
      x: t?.position?.[0] ?? 0,
      y: t?.position?.[1] ?? 0,
      width: typeof g.width === 'number' ? g.width : 120,
      height: typeof g.height === 'number' ? g.height : 80,
    });
  }
  return out;
}

function gridLayout(nodes: SceneNode[], layout: DiagramLayout, area: { width: number; height: number }): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  const params = layout.params as Record<string, unknown>;
  const cols = num(params.cols, Math.ceil(Math.sqrt(nodes.length || 1)));
  const gap = num(params.gap, 16);
  const rows = Math.ceil(nodes.length / cols) || 1;
  const cw = (area.width - (cols - 1) * gap) / cols;
  const ch = (area.height - (rows - 1) * gap) / rows;
  nodes.forEach((n, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    out.set(n.id, { x: c * (cw + gap), y: r * (ch + gap), width: cw, height: ch });
  });
  return out;
}

function nodeArea(n: SceneNode, layout: DiagramLayout, scope: Record<string, unknown>, scales: Map<string, ScaleDef>): number {
  const v = resolveChannel(layout.size_by, scope, scales, n.id);
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  const g = n.geometry as Record<string, unknown>;
  const fallback = typeof g.value === 'number' ? g.value : 1;
  return fallback > 0 ? fallback : 1;
}

function treemapLayout(
  nodes: SceneNode[], layout: DiagramLayout, scope: Record<string, unknown>,
  scales: Map<string, ScaleDef>, area: { width: number; height: number },
): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const items = nodes
    .map(n => ({ id: n.id, size: nodeArea(n, layout, scope, scales) }))
    .sort((a, b) => b.size - a.size);
  const rects = squarify(items.map(i => i.size), 0, 0, area.width, area.height);
  items.forEach((item, i) => out.set(item.id, rects[i] ?? { x: 0, y: 0, width: 0, height: 0 }));
  return out;
}

function packLayout(
  nodes: SceneNode[], layout: DiagramLayout, scope: Record<string, unknown>,
  scales: Map<string, ScaleDef>, area: { width: number; height: number },
): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const children = nodes.map(n => ({ id: n.id, value: nodeArea(n, layout, scope, scales) }));
  const root: any = hierarchy({ id: '__root__', children: children as any });
  root.sum((d: any) => d.value ?? 0);
  (d3pack() as any).size([area.width, area.height]).padding(num(layout.params?.padding, 4))(root);
  for (const leaf of root.leaves()) {
    out.set(leaf.data.id as string, { x: leaf.x - leaf.r, y: leaf.y - leaf.r, width: leaf.r * 2, height: leaf.r * 2 });
  }
  return out;
}

function layeredLayout(nodes: SceneNode[], relations: SceneRelation[], area: { width: number; height: number }, layout: DiagramLayout): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const ids = new Set(nodes.map(n => n.id));
  const adj = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) { adj.set(n.id, []); pred.set(n.id, []); indeg.set(n.id, 0); }
  for (const r of relations) {
    if (ids.has(r.source) && ids.has(r.target) && r.source !== r.target) {
      adj.get(r.source)!.push(r.target);
      pred.get(r.target)!.push(r.source);
      indeg.set(r.target, (indeg.get(r.target) ?? 0) + 1);
    }
  }
  // longest-path rank assignment (Kahn topological order)
  const rank = new Map<string, number>();
  const indegCopy = new Map(indeg);
  const topo: string[] = [];
  const q = nodes.filter(n => (indeg.get(n.id) ?? 0) === 0).map(n => n.id);
  while (q.length) {
    const id = q.shift()!;
    topo.push(id);
    for (const t of adj.get(id)!) {
      indegCopy.set(t, (indegCopy.get(t) ?? 0) - 1);
      if (indegCopy.get(t) === 0) q.push(t);
    }
  }
  // disconnected nodes not reached by topo: append at rank 0
  for (const n of nodes) if (!topo.includes(n.id)) topo.push(n.id);
  for (const id of topo) {
    if (!rank.has(id)) rank.set(id, 0);
    for (const t of adj.get(id)!) rank.set(t, Math.max(rank.get(t) ?? 0, (rank.get(id) ?? 0) + 1));
  }
  const rankGroups = new Map<number, string[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!rankGroups.has(r)) rankGroups.set(r, []);
    rankGroups.get(r)!.push(n.id);
  }
  const ranks = [...rankGroups.entries()].sort((a, b) => a[0] - b[0]);

  // Barycenter ordering (reduce edge crossings): order each rank by the
  // average index of its parents in the previous rank.
  const ordered = new Map<number, string[]>();
  for (const [r, idsInRank] of ranks) {
    if (r === 0) { ordered.set(0, idsInRank); continue; }
    const prev = ordered.get(r - 1) ?? [];
    const posInPrev = new Map(prev.map((id, i) => [id, i] as const));
    const scored = idsInRank.map(id => {
      const positions = (pred.get(id) ?? [])
        .map(p => posInPrev.get(p))
        .filter((x): x is number => x !== undefined);
      const avg = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : idsInRank.length;
      return { id, avg };
    });
    scored.sort((a, b) => a.avg - b.avg);
    ordered.set(r, scored.map(s => s.id));
  }

  const params = layout.params as Record<string, unknown>;
  const rankdir = str(params.rankdir, 'TB');
  const gap = num(params.gap, 24);
  const nodeW = num(params.node_width, 140);
  const nodeH = num(params.node_height, 50);
  for (const [r, idsInRank] of ordered) {
    const count = idsInRank.length;
    idsInRank.forEach((id, i) => {
      if (rankdir === 'LR') {
        out.set(id, { x: r * (nodeW + gap), y: area.height / 2 + (i - (count - 1) / 2) * (nodeH + gap), width: nodeW, height: nodeH });
      } else {
        out.set(id, { x: area.width / 2 + (i - (count - 1) / 2) * (nodeW + gap), y: r * (nodeH + gap), width: nodeW, height: nodeH });
      }
    });
  }
  return out;
}

function toHierarchy(n: SceneNode): { id: string; children: ReturnType<typeof toHierarchy>[] } {
  return { id: n.id, children: (n.children ?? []).map(toHierarchy) };
}

function treeLayout(nodes: SceneNode[], area: { width: number; height: number }, layout: DiagramLayout): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const root: any = hierarchy({ id: '__root__', children: nodes.map(toHierarchy) as any });
  const params = layout.params as Record<string, unknown>;
  const nodeW = num(params.node_width, 140);
  const nodeH = num(params.node_height, 50);
  const orientation = str(params.orientation, 'vertical');
  const [sx, sy] = orientation === 'horizontal' ? [area.height, area.width] : [area.width, area.height];
  (d3tree() as any).size([sx, sy])(root);
  root.each((d: any) => {
    const id = d.data.id as string;
    if (id === '__root__') return;
    if (orientation === 'horizontal') out.set(id, { x: d.y, y: d.x - nodeW / 2, width: nodeW, height: nodeH });
    else out.set(id, { x: d.x - nodeW / 2, y: d.y, width: nodeW, height: nodeH });
  });
  return out;
}

function radialLayout(nodes: SceneNode[], area: { width: number; height: number }, layout: DiagramLayout): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const root: any = hierarchy({ id: '__root__', children: nodes.map(toHierarchy) as any });
  const params = layout.params as Record<string, unknown>;
  const nodeW = num(params.node_width, 120);
  const nodeH = num(params.node_height, 40);
  const radius = Math.min(area.width, area.height) / 2 - num(params.padding, 60);
  (d3tree() as any).size([2 * Math.PI, radius])(root);
  const cx = area.width / 2, cy = area.height / 2;
  root.each((d: any) => {
    const id = d.data.id as string;
    if (id === '__root__') return;
    const angle = d.x - Math.PI / 2;
    const x = cx + d.y * Math.cos(angle);
    const y = cy + d.y * Math.sin(angle);
    out.set(id, { x: x - nodeW / 2, y: y - nodeH / 2, width: nodeW, height: nodeH });
  });
  return out;
}

function forceLayout(nodes: SceneNode[], relations: SceneRelation[], area: { width: number; height: number }, layout: DiagramLayout): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const ids = new Set(nodes.map(n => n.id));
  const params = layout.params as Record<string, unknown>;
  const nodeW = num(params.node_width, 140);
  const nodeH = num(params.node_height, 50);
  const data: any[] = nodes.map(n => ({ id: n.id }));
  const links: any[] = relations
    .filter(r => ids.has(r.source) && ids.has(r.target) && r.source !== r.target)
    .map(r => ({ source: r.source, target: r.target }));
  const sim = forceSimulation(data)
    .force('link', forceLink(links).id((d: any) => d.id).distance(num(params.link_distance, 140)))
    .force('charge', forceManyBody().strength(num(params.charge, -400)))
    .force('center', forceCenter(area.width / 2, area.height / 2))
    .force('collide', forceCollide().radius(Math.max(nodeW, nodeH) / 2 + 8));
  sim.stop();
  sim.tick(num(params.iterations, 300));
  for (const d of data) {
    out.set(d.id, { x: d.x - nodeW / 2, y: d.y - nodeH / 2, width: nodeW, height: nodeH });
  }
  return out;
}

function swimlaneLayout(
  nodes: SceneNode[], layout: DiagramLayout, scope: Record<string, unknown>,
  scales: Map<string, ScaleDef>, area: { width: number; height: number },
): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const params = layout.params as Record<string, unknown>;
  const gap = num(params.gap, 16);
  const nodeW = num(params.node_width, 140);
  const nodeH = num(params.node_height, 44);
  // assign lanes by lane_by (fallback: single lane)
  const laneIndex = new Map<string, number>();
  const laneOrder: string[] = [];
  for (const n of nodes) {
    const key = str(resolveChannel(layout.lane_by, scope, scales, n.id), 'default');
    if (!laneIndex.has(key)) { laneIndex.set(key, laneOrder.length); laneOrder.push(key); }
  }
  const laneCount = Math.max(1, laneOrder.length);
  const laneH = Math.min(nodeH, (area.height - (laneCount - 1) * gap) / laneCount);
  const nextX = new Map<number, number>();
  for (const n of nodes) {
    const key = str(resolveChannel(layout.lane_by, scope, scales, n.id), 'default');
    const li = laneIndex.get(key)!;
    const x = nextX.get(li) ?? gap;
    out.set(n.id, { x, y: li * (laneH + gap), width: nodeW, height: laneH });
    nextX.set(li, x + nodeW + gap);
  }
  return out;
}

function timelineLayout(
  nodes: SceneNode[], layout: DiagramLayout, scope: Record<string, unknown>,
  scales: Map<string, ScaleDef>, area: { width: number; height: number },
): Map<string, LayoutBox> {
  const out = new Map<string, LayoutBox>();
  if (nodes.length === 0) return out;
  const params = layout.params as Record<string, unknown>;
  const pad = num(params.pad, 48);
  const nodeH = num(params.node_height, 50);
  const entries = nodes.map(n => ({ id: n.id, t: num(resolveChannel(layout.time_by, scope, scales, n.id), 0) }));
  const times = entries.map(e => e.t);
  const tmin = Math.min(...times, 0);
  const tmax = Math.max(...times, 1);
  const span = (tmax - tmin) || 1;
  const y = num(params.y, 40);
  for (const e of entries) {
    const x = pad + ((e.t - tmin) / span) * (area.width - 2 * pad);
    out.set(e.id, { x, y, width: num(params.dot_width, 10), height: nodeH });
  }
  return out;
}

// ── Squarified treemap (Bruls, Huizing, van Wijk) ───────────────────────────

function squarify(values: number[], x: number, y: number, w: number, h: number): LayoutBox[] {
  const total = values.reduce((a, b) => a + b, 0);
  const out: LayoutBox[] = [];
  if (total <= 0 || values.length === 0 || w <= 0 || h <= 0) return out;

  const scale = (w * h) / total;
  const areas = values.map(v => v * scale);

  let remaining = areas.slice();
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const vertical = cw >= ch;
    const side = vertical ? ch : cw;

    let row: number[] = [remaining[0]];
    let rowSum = remaining[0];
    let i = 1;
    while (i < remaining.length) {
      const test = [...row, remaining[i]];
      if (worst(test, side) <= worst(row, side)) {
        row = test;
        rowSum += remaining[i];
        i++;
      } else break;
    }
    remaining = remaining.slice(i);

    if (vertical) {
      const rowW = rowSum / ch;
      let ry = cy;
      for (const a of row) {
        const rh = a / rowW;
        out.push({ x: cx, y: ry, width: rowW, height: rh });
        ry += rh;
      }
      cx += rowW;
      cw -= rowW;
    } else {
      const rowH = rowSum / cw;
      let rx = cx;
      for (const a of row) {
        const rw = a / rowH;
        out.push({ x: rx, y: cy, width: rw, height: rowH });
        rx += rw;
      }
      cy += rowH;
      ch -= rowH;
    }
  }
  return out;
}

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0);
  if (s <= 0) return Infinity;
  const rmax = Math.max(...row);
  const rmin = Math.min(...row);
  const s2 = s * s;
  const u2 = side * side;
  return Math.max((u2 * rmax) / s2, s2 / (u2 * rmin));
}
