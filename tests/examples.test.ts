import { describe, it, expect } from 'vitest';
import { render, codebaseMapExample, neuralNetExample } from '../src/index.js';

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
});
