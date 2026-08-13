// 2D SVG renderers for the 'both'-dimensionality node types that have a
// native 2D form: Vector (arrow) and Curve (polyline). The 3D interpretation
// of these types is deferred to the 3D backend.
import type { SceneNode, RendererContext } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

type Vec2 = [number, number];

function vec2(v: unknown, fallback: Vec2 = [0, 0]): Vec2 {
  if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number') {
    return [v[0], v[1]];
  }
  return fallback;
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number; }

function emptyBBox(): BBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function grow(b: BBox, x: number, y: number): void {
  if (x < b.minX) b.minX = x;
  if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y;
  if (y > b.maxY) b.maxY = y;
}

function createSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 400');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%';
  svg.style.height = '300px';
  svg.style.overflow = 'visible';
  return svg;
}

/** Project a data-space point into the SVG viewBox (flips Y for math orientation). */
function project(b: BBox, width: number, height: number, pad: number): (p: Vec2) => Vec2 {
  const spanX = b.maxX - b.minX || 1;
  const spanY = b.maxY - b.minY || 1;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return ([x, y]) => [
    width / 2 + (x - cx) * scale,
    height / 2 - (y - cy) * scale,
  ];
}

function polyline(points: Vec2[], color: string, width: number): SVGPolylineElement {
  const p = document.createElementNS(SVG_NS, 'polyline');
  p.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', color);
  p.setAttribute('stroke-width', String(width));
  return p;
}

/**
 * Vector (2D) — an arrow from `geometry.origin` along `geometry.direction`.
 * geometry: { origin, direction, length, arrowSize, shaftRadius, color }
 * content:  { label, labelPosition }
 */
export function renderVector2D(node: SceneNode, _ctx: RendererContext): HTMLElement {
  const g = node.geometry as Record<string, unknown>;
  const c = node.content as Record<string, unknown>;

  const origin = vec2(g.origin);
  const direction = vec2(g.direction, [1, 0]);
  const length = typeof g.length === 'number' ? g.length : 100;
  const arrowSize = typeof g.arrowSize === 'number' ? g.arrowSize : 10;
  const shaftWidth = typeof g.shaftRadius === 'number' ? g.shaftRadius * 2 : 2;
  const color = typeof g.color === 'string' ? g.color : '#4a9eff';

  const dLen = Math.hypot(direction[0], direction[1]) || 1;
  const dx = direction[0] / dLen;
  const dy = direction[1] / dLen;
  const end: Vec2 = [origin[0] + dx * length, origin[1] + dy * length];

  const b = emptyBBox();
  grow(b, origin[0], origin[1]);
  grow(b, end[0], end[1]);

  const svg = createSvg();
  const toSvg = project(b, 600, 400, 30);
  const p1 = toSvg(origin);
  const p2 = toSvg(end);

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', String(p1[0]));
  line.setAttribute('y1', String(p1[1]));
  line.setAttribute('x2', String(p2[0]));
  line.setAttribute('y2', String(p2[1]));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(shaftWidth));
  svg.appendChild(line);

  const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const head = document.createElementNS(SVG_NS, 'polygon');
  head.setAttribute('points', [
    `${p2[0]},${p2[1]}`,
    `${p2[0] - arrowSize * Math.cos(ang - Math.PI / 6)},${p2[1] - arrowSize * Math.sin(ang - Math.PI / 6)}`,
    `${p2[0] - arrowSize * Math.cos(ang + Math.PI / 6)},${p2[1] - arrowSize * Math.sin(ang + Math.PI / 6)}`,
  ].join(' '));
  head.setAttribute('fill', color);
  svg.appendChild(head);

  const wrap = document.createElement('div');
  wrap.className = 'exd-vector';
  wrap.appendChild(svg);

  const label = c.label as string | undefined;
  if (label) {
    const el = document.createElement('div');
    el.className = 'exd-vector-label';
    el.textContent = label;
    el.style.cssText = 'text-align:center;color:#8080b0;font-size:12px;margin-top:4px;';
    wrap.appendChild(el);
  }

  return wrap;
}

/**
 * Curve (2D) — a polyline through `content.points` (array of [x, y] / [x, y, z]).
 * Symbolic `content.parametric` expressions are not evaluable in the web
 * backend yet and fall through to a stub.
 * geometry: { tRange, samples, lineWidth, color, tube }
 * content:  { parametric } | { points }
 */
export function renderCurve2D(node: SceneNode, _ctx: RendererContext): HTMLElement {
  const g = node.geometry as Record<string, unknown>;
  const c = node.content as Record<string, unknown>;

  const color = typeof g.color === 'string' ? g.color : '#4a9eff';
  const width = typeof g.lineWidth === 'number' ? g.lineWidth : 2;

  const wrap = document.createElement('div');
  wrap.className = 'exd-curve';

  const rawPoints = c.points as unknown;
  if (Array.isArray(rawPoints) && rawPoints.length >= 2) {
    const pts = rawPoints.map(p => vec2(p));
    const b = emptyBBox();
    for (const [x, y] of pts) grow(b, x, y);
    const svg = createSvg();
    const toSvg = project(b, 600, 400, 30);
    svg.appendChild(polyline(pts.map(toSvg), color, width));
    wrap.appendChild(svg);
    return wrap;
  }

  const stub = document.createElement('div');
  stub.className = 'exd-placeholder';
  stub.style.cssText =
    'background:#1a1a2e;border:1px dashed #3a3a6a;border-radius:6px;padding:16px;' +
    'text-align:center;color:#606080;font-size:12px;';
  stub.textContent = '[Curve] 2D rendering requires content.points (parametric pending)';
  wrap.appendChild(stub);
  return wrap;
}
