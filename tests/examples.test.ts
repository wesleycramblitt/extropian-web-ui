import { describe, it, expect } from 'vitest';
import { render, codebaseMapExample, neuralNetExample, champsUiExample } from '../src/index.js';

function mount(doc: Parameters<typeof render>[0]) {
  const el = document.createElement('div');
  const view = render(doc, el);
  return { el, view };
}

describe('v1 end-to-end acceptance', () => {
  it('renders the codebase map (shapes + treemap + legend + edges)', () => {
    const { el } = mount(codebaseMapExample);
    expect(el.querySelectorAll('[data-node-type="Shape"]').length).toBe(5);
    expect(el.querySelector('.exd-legend-ramp')).toBeTruthy();
    expect(el.querySelectorAll('[data-rel-id]').length).toBe(3);
    // treemap absolutely positions the shapes inside the modules space
    const core = el.querySelector('[data-exd-id="core"]') as HTMLElement;
    expect(core.style.position).toBe('absolute');
    expect(core.style.width).not.toBe('0px');
  });

  it('renders the neural network (layered layout, left-to-right)', () => {
    const { el } = mount(neuralNetExample);
    const shapes = el.querySelectorAll('[data-node-type="Shape"]');
    expect(shapes.length).toBe(4);
    const input = el.querySelector('[data-exd-id="input"]') as HTMLElement;
    const output = el.querySelector('[data-exd-id="output"]') as HTMLElement;
    expect(parseFloat(input.style.left)).toBeLessThan(parseFloat(output.style.left));
  });

  it('supports the full loop: select → context → mutate', () => {
    const { el, view } = mount(codebaseMapExample);
    // select
    view.find('core')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // context
    const ctx = view.getContext();
    expect(ctx.selection).toEqual(['core']);
    expect(ctx.entities[0].type).toBe('Shape');
    expect(ctx.entities[0].semantic?.role).toBe('module');
    expect(ctx.relations.length).toBe(3); // all dependencies target core
    // mutate
    view.applyPatchDocument({
      ops: [
        { op: 'isolate', target: 'core', params: {} },
        { op: 'annotate', target: 'core', params: { text: 'Kernel module' } },
      ],
    });
    expect(el.querySelector('[data-annotation-id]')).toBeTruthy();
    expect(view.find('ui')!.style.opacity).toBe('0.15'); // dimmed by isolate
  });

  it('renders the CHAMPS UI codebase overview (treemap + layered deps + legend)', () => {
    const { el } = mount(champsUiExample);
    // 9 treemap modules + 9 layered dependency nodes
    expect(el.querySelectorAll('[data-node-type="Shape"]').length).toBe(18);
    // 22 dependency edges
    expect(el.querySelectorAll('[data-rel-id]').length).toBe(22);
    // ordinal legend: 5 swatches (one per role)
    expect(el.querySelectorAll('.exd-legend-swatch').length).toBe(5);
  });

  it('CHAMPS UI — selecting a module returns rich semantic context', () => {
    const { view } = mount(champsUiExample);
    view.find('viewport_dep')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const ctx = view.getContext();
    expect(ctx.selection).toEqual(['viewport_dep']);
    expect(ctx.entities[0].semantic?.role).toBe('ui');
    expect(ctx.entities[0].semantic?.explanation).toContain('7 render passes');
    // relations touching viewport_dep: incoming (gl→viewport, scene→viewport, core→viewport) + outgoing (viewport→state, viewport→gui, viewport→app)
    expect(ctx.relations.length).toBe(6);
  });
});
