import { describe, it, expect } from 'vitest';
import { render, codebaseMapExample, neuralNetExample, champsUiExample, champsUiDeepExample, cudaExample } from '../src/index.js';

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

  it('renders the CHAMPS UI deep-dive (treemap + layered + nested tree + annotations)', () => {
    const { el } = mount(champsUiDeepExample);
    // 9 treemap + 9 layered + 9 root tree modules + subcomponents (tree nodes)
    const shapes = el.querySelectorAll('[data-node-type="Shape"]');
    expect(shapes.length).toBeGreaterThan(40); // hierarchy is the bulk
    expect(el.querySelectorAll('[data-rel-id]').length).toBe(22);
    expect(el.querySelectorAll('.exd-legend-swatch').length).toBe(5);
    // summary panel table renders
    expect(el.querySelectorAll('.exd-table tbody tr').length).toBe(9);
    // annotations overlaid
    expect(el.querySelectorAll('[data-annotation-id]').length).toBe(3);
  });

  it('deep-dive — hierarchy sub-nodes expose semantic context too', () => {
    const { view } = mount(champsUiDeepExample);
    view.find('solver-sdf-gen')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const ctx = view.getContext();
    expect(ctx.selection).toEqual(['solver-sdf-gen']);
    expect(ctx.entities[0].semantic?.explanation).toContain('Scene tree → SDF');
  });

  it('renders the CUDA example (nested grid→block→thread + swimlane + memory)', () => {
    const { el } = mount(cudaExample);
    // grid (1) + 4 blocks + 128 threads = 133 shapes, plus flow + memory shapes
    const shapes = el.querySelectorAll('[data-node-type="Shape"]');
    expect(shapes.length).toBeGreaterThan(133);
    // 3 flow arrows + 3 memory arrows
    expect(el.querySelectorAll('[data-rel-id]').length).toBe(6);
    // summary equation renders as a math node
    expect(el.querySelector('[data-node-type="Equation"]')).toBeTruthy();
    // 3 annotations
    expect(el.querySelectorAll('[data-annotation-id]').length).toBe(3);
  });

  it('CUDA — threads are nested inside their block, blocks inside the grid', () => {
    const { view } = mount(cudaExample);
    const grid = view.find('grid')!;
    const block = view.find('block-0-0')!;
    const thread = view.find('t-0-0-0-0')!;
    expect(grid.contains(block)).toBe(true);
    expect(block.contains(thread)).toBe(true);
    expect(thread.style.position).toBe('absolute'); // laid out inside its block
    expect(view.getContext().entities.length).toBe(0); // nothing selected yet
  });
});
