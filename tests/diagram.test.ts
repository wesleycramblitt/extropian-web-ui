import { describe, it, expect } from 'vitest';
import { render, computeDiagramLayout, is2DSceneDocument } from '../src/index.js';
import type { SceneDocument, SceneNode, ScaleDef } from '../src/types.js';
import { baseDoc, node, container } from './helpers.js';

describe('Shape renderer', () => {
  it('renders a Shape node as an SVG with a path', () => {
    const doc = baseDoc();
    doc.nodes.push(node({
      id: 's1', type: 'Shape',
      geometry: { shape: 'Diamond', width: 80, height: 80 },
      content: { label: 'X' },
    }));
    const view = render(doc, container());
    const el = view.find('s1');
    expect(el).toBeTruthy();
    const svg = el!.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.querySelector('path')).toBeTruthy();
    expect(svg!.textContent).toBe('X');
  });

  it('renders composite shapes (Grid) with cells', () => {
    const doc = baseDoc();
    doc.nodes.push(node({ id: 'g', type: 'Shape', geometry: { shape: 'Grid', rows: 2, cols: 3 } }));
    const view = render(doc, container());
    const svg = view.find('g')!.querySelector('svg')!;
    expect(svg.querySelectorAll('rect').length).toBe(2 * 3);
  });
});

describe('Encoding (scales[])', () => {
  it('size channel injects width/height; color channel injects fill (per-node map)', () => {
    const scales: ScaleDef[] = [
      { id: 'size', type: 'linear', scheme: '', domain: [0, 100], range: [10, 100] },
      { id: 'color', type: 'linear', scheme: 'viridis', domain: [0, 100], range: [] },
    ];
    const doc = baseDoc();
    doc.scales = scales;
    doc.data_sources = { size: { s1: 50 }, complexity: { s1: 75 } };
    doc.nodes.push(node({
      id: 's1', type: 'Shape',
      geometry: { shape: 'Rect' },
      encode: {
        size: { source: 'size', scale: 'size' },
        color: { source: 'complexity', scale: 'color' },
      },
    }));
    const view = render(doc, container());
    const el = view.find('s1')!;
    expect(el.style.width).toBe('55px'); // 50 → (50/100)*90 + 10
    const path = el.querySelector('svg path')!;
    expect(path.getAttribute('fill')).toMatch(/^#/);
  });
});

describe('Diagram layout', () => {
  it('treemap partitions area proportional to node size', () => {
    const nodes: SceneNode[] = [
      node({ id: 'a', type: 'Shape', geometry: { value: 100 } }),
      node({ id: 'b', type: 'Shape', geometry: { value: 300 } }),
    ];
    const boxes = computeDiagramLayout(
      { algorithm: 'treemap', params: {} },
      nodes, {}, new Map(), { width: 400, height: 400 },
    );
    const a = boxes.get('a')!, b = boxes.get('b')!;
    expect(a).toBeTruthy();
    expect(Math.round(a.width * a.height)).toBe(40000);
    expect(Math.round(b.width * b.height)).toBe(120000);
  });

  it('grid lays out row-major', () => {
    const nodes = ['a', 'b', 'c', 'd'].map(id => node({ id, type: 'Shape' }));
    const boxes = computeDiagramLayout(
      { algorithm: 'grid', params: { cols: 2, gap: 0 } },
      nodes, {}, new Map(), { width: 200, height: 100 },
    );
    expect(boxes.get('a')).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(boxes.get('c')).toEqual({ x: 0, y: 50, width: 100, height: 50 });
  });

  it('manual uses transform.position', () => {
    const n = node({ id: 'm', type: 'Shape', transform: { position: [12, 34], rotation: [0, 0, 0, 1], scale: [1, 1, 1], anchor: 'center' } });
    const boxes = computeDiagramLayout({ algorithm: 'manual', params: {} }, [n], {}, new Map(), { width: 400, height: 400 });
    expect(boxes.get('m')).toMatchObject({ x: 12, y: 34 });
  });
});

describe('is2DSceneDocument', () => {
  it('is true for all-2D docs, false with a 3D space or node', () => {
    const doc = baseDoc();
    doc.nodes.push(node({ id: 't', type: 'Text', content: { text: 'hi' } }));
    expect(is2DSceneDocument(doc)).toBe(true);

    const d3d = baseDoc();
    d3d.spaces.push({ id: 'w', type: 'viewport3d', projection: 'perspective', background: '#000', scroll: false });
    expect(is2DSceneDocument(d3d)).toBe(false);

    const dmesh = baseDoc();
    dmesh.nodes.push(node({ id: 'm', type: 'Mesh' }));
    expect(is2DSceneDocument(dmesh)).toBe(false);
  });
});

// ── Extended layouts ────────────────────────────────────────────────────────

function rel(source: string, target: string) {
  return { id: `${source}-${target}`, source, target, style: { type: 'arrow', color: '#fff', width: 1, dash: false } };
}

describe('Extended diagram layouts', () => {
  it('layered assigns increasing ranks top-down', () => {
    const nodes = ['a', 'b', 'c'].map(id => node({ id, type: 'Shape' }));
    const boxes = computeDiagramLayout(
      { algorithm: 'layered', params: { rankdir: 'TB', gap: 0, node_width: 100, node_height: 50 } },
      nodes, {}, new Map(), { width: 800, height: 600 },
      [rel('a', 'b'), rel('b', 'c')],
    );
    expect(boxes.get('a')!.y).toBeLessThan(boxes.get('b')!.y);
    expect(boxes.get('b')!.y).toBeLessThan(boxes.get('c')!.y);
  });

  it('pack sizes circles by value', () => {
    const nodes = [
      node({ id: 'a', type: 'Shape', geometry: { value: 100 } }),
      node({ id: 'b', type: 'Shape', geometry: { value: 300 } }),
    ];
    const boxes = computeDiagramLayout(
      { algorithm: 'pack', params: { padding: 0 } },
      nodes, {}, new Map(), { width: 400, height: 400 },
    );
    expect(boxes.get('b')!.width).toBeGreaterThan(boxes.get('a')!.width);
  });

  it('tree positions descendants below their parent', () => {
    const root = node({ id: 'root', type: 'Group', children: [node({ id: 'a', type: 'Shape' }), node({ id: 'b', type: 'Shape' })] });
    const boxes = computeDiagramLayout({ algorithm: 'tree', params: {} }, [root], {}, new Map(), { width: 400, height: 400 });
    expect(boxes.has('root')).toBe(true);
    expect(boxes.has('a')).toBe(true);
    expect(boxes.has('b')).toBe(true);
    expect(boxes.get('a')!.y).toBeGreaterThan(boxes.get('root')!.y);
  });

  it('force returns a box for every node', () => {
    const nodes = ['a', 'b', 'c'].map(id => node({ id, type: 'Shape' }));
    const boxes = computeDiagramLayout(
      { algorithm: 'force', params: { iterations: 100 } },
      nodes, {}, new Map(), { width: 400, height: 400 },
      [rel('a', 'b'), rel('b', 'c')],
    );
    expect(boxes.size).toBe(3);
  });

  it('swimlane separates nodes by lane channel', () => {
    const nodes = [node({ id: 'a', type: 'Shape' }), node({ id: 'b', type: 'Shape' })];
    const boxes = computeDiagramLayout(
      { algorithm: 'swimlane', lane_by: { source: 'lane' }, params: {} },
      nodes, { lane: { a: 'cpu', b: 'gpu' } }, new Map(), { width: 400, height: 200 },
    );
    expect(boxes.get('a')!.y).not.toBe(boxes.get('b')!.y);
  });

  it('timeline orders nodes left-to-right by time channel', () => {
    const nodes = [node({ id: 'a', type: 'Shape' }), node({ id: 'b', type: 'Shape' })];
    const boxes = computeDiagramLayout(
      { algorithm: 'timeline', time_by: { source: 't' }, params: {} },
      nodes, { t: { a: 0, b: 100 } }, new Map(), { width: 400, height: 200 },
    );
    expect(boxes.get('a')!.x).toBeLessThan(boxes.get('b')!.x);
  });

  it('timeline gantt stacks overlapping bars into separate lanes', () => {
    const nodes = [node({ id: 'a', type: 'Shape' }), node({ id: 'b', type: 'Shape' }), node({ id: 'c', type: 'Shape' })];
    const boxes = computeDiagramLayout(
      { algorithm: 'timeline', start_by: { source: 'start' }, end_by: { source: 'end' }, params: {} },
      nodes, { start: { a: 0, b: 5, c: 10 }, end: { a: 20, b: 15, c: 30 } }, new Map(), { width: 400, height: 200 },
    );
    // a[0,20], b[5,15], c[10,30] all mutually overlap → three distinct lanes.
    const ys = new Set([boxes.get('a')!.y, boxes.get('b')!.y, boxes.get('c')!.y]);
    expect(ys.size).toBe(3);
    expect(boxes.get('a')!.width).toBeGreaterThan(0);
  });
});

describe('Legend', () => {
  it('renders a color ramp for a continuous scale', () => {
    const doc = baseDoc();
    doc.scales = [{ id: 'complexity', type: 'linear', scheme: 'viridis', domain: [0, 100], range: [] }];
    doc.nodes.push(node({ id: 'legend', type: 'Legend', content: { scale: 'complexity', title: 'Complexity' } }));
    const view = render(doc, container());
    const el = view.find('legend')!;
    expect(el.querySelector('.exd-legend-title')!.textContent).toBe('Complexity');
    expect(el.querySelector('.exd-legend-ramp')).toBeTruthy();
  });

  it('renders swatches for an ordinal scale', () => {
    const doc = baseDoc();
    doc.scales = [{ id: 'cat', type: 'ordinal', scheme: 'category10', domain: ['a', 'b', 'c'], range: [] }];
    doc.nodes.push(node({ id: 'legend', type: 'Legend', content: { scale: 'cat' } }));
    const view = render(doc, container());
    expect(view.find('legend')!.querySelectorAll('.exd-legend-swatch').length).toBe(3);
  });

  it('shows a fallback for an unknown scale', () => {
    const doc = baseDoc();
    doc.nodes.push(node({ id: 'legend', type: 'Legend', content: { scale: 'nope' } }));
    const view = render(doc, container());
    expect(view.find('legend')!.querySelector('.exd-legend-missing')).toBeTruthy();
  });
});
