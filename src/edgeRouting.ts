// Edge routing — anchors relation endpoints to node ports and generates SVG
// path data for the relation styles (line/arrow/elbow/bezier/tube).
import type { Port } from './types.js';

export interface Rect { left: number; top: number; width: number; height: number; }
export interface Anchor { x: number; y: number; }

const SIDES = ['north', 'east', 'south', 'west'] as const;
export type Side = (typeof SIDES)[number];

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function anchorOnSide(rect: Rect, side: Side, position: number): Anchor {
  const pos = clamp01(position);
  switch (side) {
    case 'north': return { x: rect.left + rect.width * pos, y: rect.top };
    case 'south': return { x: rect.left + rect.width * pos, y: rect.top + rect.height };
    case 'east': return { x: rect.left + rect.width, y: rect.top + rect.height * pos };
    case 'west': return { x: rect.left, y: rect.top + rect.height * pos };
  }
}

/**
 * Compute the anchor point for a relation endpoint.
 * `portSpec` is a declared port id (from `node.ports`), or a side name
 * ("north"/"east"/"south"/"west"), or undefined (center).
 */
export function resolvePortAnchor(rect: Rect, portSpec: string | undefined, ports: Port[]): Anchor {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  if (!portSpec) return { x: cx, y: cy };
  const port = ports.find(p => p.id === portSpec);
  if (port) return anchorOnSide(rect, port.side, port.position ?? 0.5);
  if ((SIDES as readonly string[]).includes(portSpec)) {
    return anchorOnSide(rect, portSpec as Side, 0.5);
  }
  return { x: cx, y: cy };
}

/** Generate SVG path `d` for a relation between two anchors. */
export function edgePath(x1: number, y1: number, x2: number, y2: number, type: string): string {
  switch (type) {
    case 'elbow': {
      const mx = (x1 + x2) / 2;
      return `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
    }
    case 'bezier': {
      const dx = Math.max(30, Math.abs(x2 - x1) / 2);
      return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
    }
    case 'tube':
    case 'line':
    case 'arrow':
    default:
      return `M${x1},${y1} L${x2},${y2}`;
  }
}
