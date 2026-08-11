import type { RendererContext } from '../types.js';
import type { Matrix } from '../types.js';

export function renderMatrixComp(spec: Matrix, _ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-matrix';

  const tbl = document.createElement('table');
  const rows = spec.values.length;
  const cols = spec.values[0]?.length ?? 0;

  // Col headers
  if (spec.colLabels && spec.colLabels.length > 0) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    if (spec.rowLabels) tr.appendChild(document.createElement('th')); // corner
    for (const lbl of spec.colLabels) {
      const th = document.createElement('th');
      th.textContent = lbl;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    tbl.appendChild(thead);
  }

  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    // Row header
    if (spec.rowLabels && spec.rowLabels[r] !== undefined) {
      const th = document.createElement('th');
      th.textContent = spec.rowLabels[r];
      tr.appendChild(th);
    }
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.textContent = String(spec.values[r]?.[c] ?? '');
      // Numeric cells right-aligned
      if (typeof spec.values[r]?.[c] === 'number') {
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
