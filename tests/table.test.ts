import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { baseDoc, node, container } from './helpers.js';

describe('Table adapter fidelity', () => {
  it('honors sortable, striped, filterable, and maxHeight', () => {
    const doc = baseDoc();
    doc.nodes.push(node({
      id: 't', type: 'Table',
      geometry: { sortable: true, striped: true, filterable: true, maxHeight: 200 },
      content: { columns: ['name', 'size'], rows: [['b', 2], ['a', 1], ['c', 3]] },
    }));
    const view = render(doc, container());
    const el = view.find('t')!;

    expect(el.classList.contains('exd-table-striped')).toBe(true);
    expect(el.querySelector('.exd-table-filter')).toBeTruthy();
    expect(el.style.maxHeight).toBe('200px');

    // click-to-sort by the first column
    const th = el.querySelector('th')!;
    th.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const firstCells = Array.from(el.querySelectorAll('tbody td:first-child')).map(td => td.textContent);
    expect(firstCells).toEqual(['a', 'b', 'c']);
  });

  it('filters rows by substring', () => {
    const doc = baseDoc();
    doc.nodes.push(node({
      id: 't', type: 'Table',
      geometry: { filterable: true },
      content: { columns: ['name'], rows: [['cat'], ['dog'], ['bird']] },
    }));
    const view = render(doc, container());
    const el = view.find('t')!;
    const input = el.querySelector('.exd-table-filter') as HTMLInputElement;
    input.value = 'd'; // matches dog + bird, not cat
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const cells = Array.from(el.querySelectorAll('tbody td')).map(td => td.textContent);
    expect(cells).toEqual(['dog', 'bird']);
  });
});
