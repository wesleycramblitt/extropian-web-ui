import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { baseDoc, node, container } from './helpers.js';

describe('Node-level containment (arrangement)', () => {
  it('lays out children inside a container shape (grid)', () => {
    const doc = baseDoc();
    doc.nodes.push(node({
      id: 'module', type: 'Shape', space: 'screen',
      geometry: { shape: 'RoundedRect', width: 400, height: 300 },
      arrangement: { algorithm: 'grid', params: { cols: 2, gap: 8 } },
      children: [
        node({ id: 'a', type: 'Shape', geometry: { shape: 'Rect' } }),
        node({ id: 'b', type: 'Shape', geometry: { shape: 'Rect' } }),
        node({ id: 'c', type: 'Shape', geometry: { shape: 'Rect' } }),
        node({ id: 'd', type: 'Shape', geometry: { shape: 'Rect' } }),
      ],
    }));
    const view = render(doc, container());
    const moduleEl = view.find('module')!;
    expect(moduleEl.contains(view.find('a')!)).toBe(true);
    expect(moduleEl.contains(view.find('d')!)).toBe(true);
    expect(view.find('a')!.style.position).toBe('absolute');
    expect(view.find('a')!.style.left).not.toBe(view.find('b')!.style.left);
    expect(view.find('a')!.style.top).not.toBe(view.find('c')!.style.top);
  });

  it('supports nested containers recursively (grid → pack inside)', () => {
    const doc = baseDoc();
    doc.nodes.push(node({
      id: 'root', type: 'Shape', space: 'screen',
      geometry: { shape: 'RoundedRect', width: 600, height: 400 },
      arrangement: { algorithm: 'grid', params: { cols: 2, gap: 12 } },
      children: [
        node({
          id: 'sub1', type: 'Shape',
          geometry: { shape: 'Rect' },
          arrangement: { algorithm: 'pack', params: { padding: 8 } },
          children: [
            node({ id: 's1a', type: 'Shape', geometry: { shape: 'Circle', value: 100 } }),
            node({ id: 's1b', type: 'Shape', geometry: { shape: 'Circle', value: 300 } }),
          ],
        }),
        node({ id: 'sub2', type: 'Shape', geometry: { shape: 'Rect' } }),
      ],
    }));
    const view = render(doc, container());
    const sub1 = view.find('sub1')!;
    expect(sub1.contains(view.find('s1a')!)).toBe(true);
    expect(sub1.contains(view.find('s1b')!)).toBe(true);
    // pack: larger value → larger circle box
    expect(parseFloat(view.find('s1b')!.style.width)).toBeGreaterThan(parseFloat(view.find('s1a')!.style.width));
    // sub1 fills its parent-assigned grid cell (600-wide grid, 2 cols → ~294px)
    expect(parseFloat(sub1.style.width)).toBeGreaterThan(250);
  });

  it('supports force layout inside a container', () => {
    const doc = baseDoc();
    doc.nodes.push(node({
      id: 'box', type: 'Shape', space: 'screen',
      geometry: { shape: 'RoundedRect', width: 500, height: 400 },
      arrangement: { algorithm: 'force', params: { iterations: 120 } },
      children: ['n1', 'n2', 'n3', 'n4'].map(id => node({ id, type: 'Shape', geometry: { shape: 'Circle' } })),
    }));
    const view = render(doc, container());
    const box = view.find('box')!;
    expect(box.contains(view.find('n1')!)).toBe(true);
    expect(view.find('n1')!.style.position).toBe('absolute');
  });
});
