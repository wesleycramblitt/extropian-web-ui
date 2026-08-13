import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { baseDoc, node, container } from './helpers.js';

function rel(source: string, target: string) {
  return { id: `${source}-${target}`, source, target, style: { type: 'arrow', color: '#fff', width: 1, dash: false } };
}

function twoShapes() {
  const doc = baseDoc();
  doc.nodes.push(node({ id: 'a', type: 'Shape', geometry: { shape: 'Rect' } }));
  doc.nodes.push(node({ id: 'b', type: 'Shape', geometry: { shape: 'Rect' } }));
  return doc;
}

describe('AI mutation runtime (applyPatchDocument)', () => {
  it('highlight applies a primary override', () => {
    const view = render(twoShapes(), container());
    view.applyPatchDocument({ ops: [{ op: 'highlight', target: 'a', params: {} }] });
    expect(view.find('a')!.style.boxShadow).toBeTruthy();
    expect(view.find('b')!.style.boxShadow).toBeFalsy();
  });

  it('isolate dims all but the target', () => {
    const view = render(twoShapes(), container());
    view.applyPatchDocument({ ops: [{ op: 'isolate', target: 'a', params: {} }] });
    expect(view.find('b')!.style.opacity).toBe('0.15');
    expect(view.find('a')!.style.opacity).not.toBe('0.15');
  });

  it('annotate adds a callout', () => {
    const el = container();
    const view = render(twoShapes(), el);
    view.applyPatchDocument({ ops: [{ op: 'annotate', target: 'a', params: { text: 'hello' } }] });
    const ann = el.querySelector('[data-annotation-id]');
    expect(ann).toBeTruthy();
    expect(ann!.textContent).toBe('hello');
  });

  it('reset clears overrides', () => {
    const view = render(twoShapes(), container());
    view.applyPatchDocument({ ops: [{ op: 'highlight', target: 'a', params: {} }] });
    view.applyPatchDocument({ ops: [{ op: 'reset', target: '', params: {} }] });
    expect(view.find('a')!.style.boxShadow).toBeFalsy();
  });

  it('emits mutations:applied', () => {
    const view = render(twoShapes(), container());
    let fired = 0;
    view.on('mutations:applied', () => fired++);
    view.applyPatchDocument({ ops: [{ op: 'highlight', target: 'a', params: {} }] });
    expect(fired).toBe(1);
  });
});

describe('Selection', () => {
  it('click selects, shift-click toggles, empty click clears', () => {
    const el = container();
    const view = render(twoShapes(), el);
    const a = view.find('a')!, b = view.find('b')!;

    a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.getFocus().selection).toEqual(['a']);

    b.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(view.getFocus().selection).toEqual(['a', 'b']);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(view.getFocus().selection).toEqual(['b']);

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.getFocus().selection).toEqual([]);
  });

  it('marks selected elements with data-exd-selected', () => {
    const view = render(twoShapes(), container());
    view.find('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.find('a')!.getAttribute('data-exd-selected')).toBe('true');
    expect(view.find('b')!.getAttribute('data-exd-selected')).toBeNull();
  });

  it('emits selection:change', () => {
    const view = render(twoShapes(), container());
    let fired = 0;
    view.on('selection:change', () => fired++);
    view.find('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).toBe(1);
  });
});

describe('getContext', () => {
  it('returns enriched selection context', () => {
    const doc = baseDoc();
    doc.state = { A: 5 };
    doc.nodes.push(node({
      id: 'a', type: 'Shape',
      semantic: { role: 'r', concept_id: 'c', kind: 'k', explanation: 'e', tags: [] },
      content: { label: 'Module A' },
    }));
    doc.nodes.push(node({ id: 'b', type: 'Shape', content: { label: 'Module B' } }));
    doc.relations = [rel('a', 'b')];

    const view = render(doc, container());
    view.find('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const ctx = view.getContext();
    expect(ctx.selection).toEqual(['a']);
    expect(ctx.focus).toBe('a');
    expect(ctx.entities).toHaveLength(1);
    expect(ctx.entities[0].type).toBe('Shape');
    expect(ctx.entities[0].label).toBe('Module A');
    expect(ctx.entities[0].semantic?.role).toBe('r');
    expect(ctx.relations).toHaveLength(1);
    expect(ctx.state.A).toBe(5);
  });
});

describe('Drag', () => {
  function arrangedDoc() {
    const doc = baseDoc();
    doc.spaces.push({ id: 'canvas', type: 'cartesian2d', projection: 'orthographic', background: '#000', scroll: false, arrangement: { algorithm: 'manual', params: {} } });
    return doc;
  }

  it('drags a manual-layout node with drag:true', () => {
    const doc = arrangedDoc();
    doc.nodes.push(node({
      id: 'd', type: 'Shape', space: 'canvas',
      interaction: { hover: true, select: true, drag: true, focus: true, inspect: true, edit: false },
    }));
    const view = render(doc, container());
    const el = view.find('d')!;
    expect(el.style.position).toBe('absolute');
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 25 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(el.style.left).toBe('50px');
    expect(el.style.top).toBe('25px');
  });

  it('does not drag a node with drag:false', () => {
    const doc = arrangedDoc();
    doc.nodes.push(node({ id: 'd', type: 'Shape', space: 'canvas' })); // drag false by default
    const view = render(doc, container());
    const el = view.find('d')!;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 25 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(el.style.left).toBe('0px');
  });
});

describe('Interaction gating', () => {
  it('does not hover-highlight a node with hover:false', () => {
    const doc = baseDoc();
    doc.nodes.push(node({ id: 'h', type: 'Shape', interaction: { hover: false, select: true, drag: false, focus: true, inspect: true, edit: false } }));
    const view = render(doc, container());
    view.find('h')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(view.find('h')!.getAttribute('data-exd-hovered')).toBeNull();
  });

  it('does not select a node with select:false', () => {
    const doc = baseDoc();
    doc.nodes.push(node({ id: 's', type: 'Shape', interaction: { hover: true, select: false, drag: false, focus: true, inspect: true, edit: false } }));
    const view = render(doc, container());
    view.find('s')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.getFocus().selection).toEqual([]);
  });
});
