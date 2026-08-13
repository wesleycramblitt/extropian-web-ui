// Visual scale engine — maps metric domains to visual ranges (color, size,
// opacity) for the Encoding/ChannelSpec contract, plus the per-node encoding
// application used by the renderer.
import type { ScaleDef, ChannelSpec, Encoding, SceneNode } from './types.js';

// ── Color schemes ───────────────────────────────────────────────────────────
// Category schemes are exact color lists; sequential/diverging schemes are
// stop arrays interpolated linearly. Expand this table to add palettes.
const SCHEMES: Record<string, string[]> = {
  category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
  category20: ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'],
  blues: ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
  viridis: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
  magma: ['#000004', '#2d1160', '#721f81', '#b73779', '#f1605d', '#feb078', '#fcfdbf'],
  inferno: ['#000004', '#320a5a', '#781c6d', '#bc3754', '#ed6925', '#fbb61a', '#fcffa4'],
  plasma: ['#0d0887', '#5b02a0', '#a3318a', '#db5c68', '#f58d46', '#fbc226', '#f0f921'],
  diverging: ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
};

const DEFAULT_SCHEME = SCHEMES.viridis;

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (v: number) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Interpolate a color scheme's stops at t ∈ [0,1]. */
function sampleStops(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0];
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.floor(x);
  const j = Math.min(i + 1, stops.length - 1);
  const f = x - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[j]);
  return rgbToHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

// ── Data lookup ─────────────────────────────────────────────────────────────

/** Resolve a dotted/bracket path into a scope: `"metrics.code_size"`, `"A[0]"`. */
export function lookupPath(scope: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^\$/, '').split(/[.[\]]+/).filter(Boolean);
  let cur: unknown = scope;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) cur = cur[Number(p)];
    else cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Resolve a channel source. Convention: the value at `source` may be a scalar
 * (shared by all nodes) or a map keyed by node id (per-node metrics).
 */
export function resolveChannelValue(source: string, scope: Record<string, unknown>, nodeId?: string): unknown {
  const v = lookupPath(scope, source);
  if (nodeId !== undefined && v && typeof v === 'object' && !Array.isArray(v) && nodeId in v) {
    return (v as Record<string, unknown>)[nodeId];
  }
  return v;
}

// ── Scale construction ──────────────────────────────────────────────────────

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function numDomain(v: unknown): [number, number] {
  const a = asArray(v);
  const d0 = typeof a[0] === 'number' ? a[0] : 0;
  const d1 = typeof a[1] === 'number' ? a[1] : d0 + 1;
  return [d0, d1];
}

/** Build a scale function from a ScaleDef. */
export function createScale(def: ScaleDef): (v: unknown) => unknown {
  switch (def.type) {
    case 'ordinal': {
      const cats = asArray(def.domain);
      const range = asArray(def.range).length ? asArray(def.range) : (SCHEMES[def.scheme] ?? SCHEMES.category10);
      return (v: unknown) => {
        const i = cats.indexOf(v);
        return i >= 0 && i < range.length ? range[i] : range[range.length - 1];
      };
    }
    case 'threshold': {
      const thresholds = asArray(def.domain).map(Number);
      const range = asArray(def.range).length ? asArray(def.range) : (SCHEMES[def.scheme] ?? SCHEMES.category10);
      return (v: unknown) => {
        const n = Number(v);
        let i = 0;
        while (i < thresholds.length && n >= thresholds[i]) i++;
        return range[Math.min(i, range.length - 1)];
      };
    }
    case 'quantize': {
      const [d0, d1] = numDomain(def.domain);
      const range = asArray(def.range).length ? asArray(def.range) : (SCHEMES[def.scheme] ?? SCHEMES.category10);
      return (v: unknown) => {
        const t = clamp01((Number(v) - d0) / (d1 - d0 || 1));
        const i = Math.min(Math.floor(t * range.length), range.length - 1);
        return range[i];
      };
    }
    case 'log':
      return makeContinuous(def, x => Math.log10(Math.max(x, 1e-9)));
    case 'sqrt':
      return makeContinuous(def, x => Math.sqrt(Math.max(x, 0)));
    case 'linear':
    default:
      return makeContinuous(def, x => x);
  }
}

function makeContinuous(def: ScaleDef, transform: (x: number) => number): (v: unknown) => unknown {
  const [d0, d1] = numDomain(def.domain);
  const t0 = transform(d0);
  const t1 = transform(d1);
  const range = asArray(def.range);
  const stops = SCHEMES[def.scheme];

  return (v: unknown) => {
    const t = clamp01((transform(Number(v)) - t0) / (t1 - t0 || 1));
    if (range.length >= 2 && typeof range[0] === 'number') {
      return range[0] + ((range[1] as number) - (range[0] as number)) * t;
    }
    if (range.length >= 2 && typeof range[0] === 'string') {
      return sampleStops(range as string[], t);
    }
    if (stops) return sampleStops(stops, t);
    return t; // default: normalized 0..1
  };
}

// ── Channel + encoding resolution ───────────────────────────────────────────

/** Resolve one channel spec to its final value (source → optional scale). */
export function resolveChannel(
  spec: ChannelSpec | undefined,
  scope: Record<string, unknown>,
  registry: Map<string, ScaleDef>,
  nodeId?: string,
): unknown {
  if (!spec) return undefined;
  const raw = resolveChannelValue(spec.source, scope, nodeId);
  if (raw === undefined || raw === null) return undefined;
  if (!spec.scale) return raw;
  const def = registry.get(spec.scale);
  if (!def) return raw;
  return createScale(def)(raw);
}

/**
 * Apply a node's `encode` to its geometry/style/content (mutates in place).
 * Resolved before rendering so existing renderers pick the values up naturally.
 */
export function applyEncoding(node: SceneNode, registry: Map<string, ScaleDef>, scope: Record<string, unknown>): void {
  const e = node.encode;
  if (!e) return;
  const g = node.geometry as Record<string, unknown>;
  const c = node.content as Record<string, unknown>;
  const id = node.id;

  const size = resolveChannel(e.size, scope, registry, id);
  if (typeof size === 'number' && Number.isFinite(size)) {
    g.width = size;
    g.height = size;
  }

  const color = resolveChannel(e.color, scope, registry, id);
  if (typeof color === 'string') {
    g.fill = color;
    g.color = color;
    g.stroke = color;
  }

  const opacity = resolveChannel(e.opacity, scope, registry, id);
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    node.style.opacity = clamp01(opacity);
  }

  if (node.type === 'Shape') {
    const shape = resolveChannel(e.shape, scope, registry, id);
    if (typeof shape === 'string') g.shape = shape;
  }

  const label = resolveChannel(e.label, scope, registry, id);
  if (label !== undefined && label !== null) {
    if (node.type === 'Shape') c.label = String(label);
    else c.text = String(label);
  }
}

export { SCHEMES };
