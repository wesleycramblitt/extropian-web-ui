import { describe, it, expect } from 'vitest';
import { resolvePortAnchor, edgePath } from '../src/edgeRouting.js';

describe('edge routing', () => {
  it('anchors to center when no port is given', () => {
    expect(resolvePortAnchor({ left: 0, top: 0, width: 100, height: 50 }, undefined, [])).toEqual({ x: 50, y: 25 });
  });

  it('anchors to a side midpoint', () => {
    expect(resolvePortAnchor({ left: 0, top: 0, width: 100, height: 50 }, 'east', [])).toEqual({ x: 100, y: 25 });
    expect(resolvePortAnchor({ left: 0, top: 0, width: 100, height: 50 }, 'south', [])).toEqual({ x: 50, y: 50 });
  });

  it('anchors to a declared port by id', () => {
    const anchor = resolvePortAnchor(
      { left: 0, top: 0, width: 100, height: 50 },
      'out',
      [{ id: 'out', side: 'west', position: 0.25 }],
    );
    expect(anchor).toEqual({ x: 0, y: 12.5 });
  });

  it('generates an orthogonal elbow path', () => {
    expect(edgePath(0, 0, 100, 50, 'elbow')).toContain('L50,0 L50,50');
  });

  it('generates a bezier curve path', () => {
    expect(edgePath(0, 0, 100, 50, 'bezier')).toContain('C');
  });

  it('generates a straight path for line/arrow/tube', () => {
    expect(edgePath(0, 0, 100, 50, 'arrow')).toBe('M0,0 L100,50');
  });
});
