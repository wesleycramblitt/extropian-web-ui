import type { RendererContext } from '../types.js';
import type { Table } from '../types.js';

export function renderTableComp(spec: Table, _ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-table';

  const tbl = document.createElement('table');
  const cols = spec.columns ?? spec.rows[0]?.map((_, i) => `Col ${i + 1}`) ?? [];

  // Header
  if (cols.length > 0) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    for (const col of cols) {
      const th = document.createElement('th');
      th.textContent = col;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    tbl.appendChild(thead);
  }

  // Body
  const tbody = document.createElement('tbody');
  for (const row of spec.rows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = String(cell ?? '');
      if (typeof cell === 'number') {
        td.style.textAlign = 'right';
        td.style.fontVariantNumeric = 'tabular-nums';
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);

  el.appendChild(tbl);
  return el;
}
