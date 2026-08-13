// Shape renderer — SceneNode{type:'Shape'} → SVG geometric primitive.
// Shapes are drawn in a normalized 0..100 coordinate space (viewBox), so the
// actual pixel size is controlled by the element's CSS box (flow layout, or
// absolute positioning from a diagram layout).
import type { SceneNode, RendererContext } from '../types.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 100, H = 100; // normalized geometry space

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function str(v: unknown, d: string): string {
  return typeof v === 'string' ? v : d;
}
function poly(pts: [number, number][]): string {
  return 'M' + pts.map(([x, y]) => `${x},${y}`).join(' L') + ' Z';
}

// ── Simple shape paths (normalized 0..100) ──────────────────────────────────

function rectPath(): string { return `M0,0 H${W} V${H} H0 Z`; }

function roundedRectPath(r: number): string {
  const rr = Math.min(r, W / 2, H / 2);
  return `M${rr},0 H${W - rr} Q${W},0 ${W},${rr} V${H - rr} Q${W},${H} ${W - rr},${H} H${rr} Q0,${H} 0,${H - rr} V${rr} Q0,0 ${rr},0 Z`;
}

function ellipsePath(): string {
  return `M${W / 2},0 A${W / 2},${H / 2} 0 1 0 ${W / 2},${H} A${W / 2},${H / 2} 0 1 0 ${W / 2},0 Z`;
}

function diamondPath(): string {
  return poly([[W / 2, 0], [W, H / 2], [W / 2, H], [0, H / 2]]);
}

function hexagonPath(): string {
  const s = Math.min(W / 4, H / 2);
  return poly([[s, 0], [W - s, 0], [W, H / 2], [W - s, H], [s, H], [0, H / 2]]);
}

function parallelogramPath(): string {
  const s = Math.min(W / 4, H / 2);
  return poly([[s, 0], [W, 0], [W - s, H], [0, H]]);
}

function trianglePath(): string {
  return poly([[W / 2, 0], [W, H], [0, H]]);
}

function pillPath(): string {
  const r = H / 2;
  return `M${r},0 H${W - r} A${r},${r} 0 0 1 ${W - r},${H} H${r} A${r},${r} 0 0 1 ${r},0 Z`;
}

function documentPath(): string {
  const fold = Math.min(W, H) * 0.25;
  return poly([[0, 0], [W - fold, 0], [W, fold], [W, H], [0, H]]);
}

function shapePath(type: string): string | null {
  switch (type) {
    case 'RoundedRect': return roundedRectPath(12);
    case 'Circle': return null;      // rendered as <circle>
    case 'Ellipse': return ellipsePath();
    case 'Diamond': return diamondPath();
    case 'Hexagon': return hexagonPath();
    case 'Parallelogram': return parallelogramPath();
    case 'Triangle': return trianglePath();
    case 'Pill': return pillPath();
    case 'Cylinder': return null;    // compound
    case 'Stack': return null;       // compound
    case 'Grid': return null;        // compound
    case 'Strip': return null;       // compound
    case 'Document': return documentPath();
    case 'Rect':
    default: return rectPath();
  }
}

// ── Compound shapes ─────────────────────────────────────────────────────────

function appendCylinder(svg: SVGSVGElement, fill: string, stroke: string, sw: number): void {
  const ry = H * 0.16;
  const bodyTop = ry;
  const bodyBottom = H - ry;
  // top ellipse
  const top = el('ellipse', { cx: W / 2, cy: bodyTop, rx: W / 2, ry, fill: fill, stroke, 'stroke-width': sw });
  // body
  const body = el('path', { d: `M0,${bodyTop} L0,${bodyBottom} A${W / 2},${ry} 0 0 0 ${W},${bodyBottom} L${W},${bodyTop}`, fill, stroke, 'stroke-width': sw });
  svg.appendChild(body);
  svg.appendChild(top);
}

function appendGrid(svg: SVGSVGElement, fill: string, stroke: string, sw: number, rows: number, cols: number): void {
  const cellW = W / cols, cellH = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      svg.appendChild(el('rect', { x: c * cellW, y: r * cellH, width: cellW, height: cellH, fill, stroke, 'stroke-width': sw }));
    }
  }
}

function appendStack(svg: SVGSVGElement, fill: string, stroke: string, sw: number, count: number): void {
  const gap = 2;
  const plateH = (H - (count - 1) * gap) / count;
  for (let i = 0; i < count; i++) {
    svg.appendChild(el('rect', { x: 0, y: i * (plateH + gap), width: W, height: plateH, fill, stroke, 'stroke-width': sw }));
  }
}

function appendStrip(svg: SVGSVGElement, fill: string, stroke: string, sw: number, count: number): void {
  const gap = 2;
  const laneW = (W - (count - 1) * gap) / count;
  for (let i = 0; i < count; i++) {
    svg.appendChild(el('rect', { x: i * (laneW + gap), y: 0, width: laneW, height: H, fill, stroke, 'stroke-width': sw }));
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function renderShape(node: SceneNode, _ctx: RendererContext): HTMLElement {
  const g = node.geometry as Record<string, unknown>;
  const c = node.content as Record<string, unknown>;

  const width = num(g.width, 120);
  const height = num(g.height, 80);
  const shape = str(g.shape, 'Rect');
  const fill = str(g.fill, '#2a2a5a');
  const stroke = str(g.stroke, '#4a4a7a');
  const strokeWidth = num(g.strokeWidth, 1.5);
  const label = str(c.label ?? c.text, '');

  const svg = el('svg', {});
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  const d = shapePath(shape);
  if (d !== null) {
    svg.appendChild(el('path', { d, fill, stroke, 'stroke-width': strokeWidth }));
  } else if (shape === 'Circle') {
    svg.appendChild(el('circle', { cx: W / 2, cy: H / 2, r: Math.min(W, H) / 2, fill, stroke, 'stroke-width': strokeWidth }));
  } else if (shape === 'Cylinder') {
    appendCylinder(svg, fill, stroke, strokeWidth);
  } else if (shape === 'Grid') {
    appendGrid(svg, fill, stroke, strokeWidth, num(g.rows, 4), num(g.cols, 3));
  } else if (shape === 'Stack') {
    appendStack(svg, fill, stroke, strokeWidth, num(g.count, 4));
  } else if (shape === 'Strip') {
    appendStrip(svg, fill, stroke, strokeWidth, num(g.count, 8));
  } else {
    svg.appendChild(el('path', { d: rectPath(), fill, stroke, 'stroke-width': strokeWidth }));
  }

  if (label) {
    const text = el('text', {
      x: W / 2, y: H / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: '#e0e0e0', 'font-size': 14, 'font-family': 'Inter, sans-serif',
      'pointer-events': 'none',
    });
    text.textContent = label;
    svg.appendChild(text);
  }

  const wrap = document.createElement('div');
  wrap.className = 'exd-shape';
  wrap.style.width = `${width}px`;
  wrap.style.height = `${height}px`;
  wrap.style.overflow = 'visible';
  wrap.appendChild(svg);
  return wrap;
}
