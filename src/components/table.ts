import type { RendererContext } from '../types.js';
import type { Table } from '../types.js';

export function renderTableComp(spec: Table, _ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-table';
  if (spec.striped) el.classList.add('exd-table-striped');
  if (spec.maxHeight) {
    el.style.maxHeight = `${spec.maxHeight}px`;
    el.style.overflowY = 'auto';
  }

  const rows: (string | number)[][] = (spec.rows ?? []).map(r => [...r]);
  const cols = spec.columns ?? spec.rows[0]?.map((_, i) => `Col ${i + 1}`) ?? [];

  const tbl = document.createElement('table');
  const headerCells: HTMLElement[] = [];
  let sortCol = -1;
  let sortDir: 0 | 1 | -1 = 0;
  let filterText = '';

  // Header (with optional click-to-sort)
  if (cols.length > 0) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    cols.forEach((col, i) => {
      const th = document.createElement('th');
      th.textContent = col;
      if (spec.sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          if (sortCol === i) sortDir = sortDir === 1 ? -1 : 1;
          else { sortCol = i; sortDir = 1; }
          rows.sort((a, b) => {
            const av = a[i], bv = b[i];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
            return String(av ?? '').localeCompare(String(bv ?? '')) * sortDir;
          });
          updateIndicators();
          renderBody();
        });
      }
      tr.appendChild(th);
      headerCells.push(th);
    });
    thead.appendChild(tr);
    tbl.appendChild(thead);
  }

  // Optional filter input
  if (spec.filterable) {
    const input = document.createElement('input');
    input.className = 'exd-table-filter';
    input.type = 'text';
    input.placeholder = 'Filter…';
    input.addEventListener('input', () => { filterText = input.value.toLowerCase(); renderBody(); });
    el.appendChild(input);
  }

  const tbody = document.createElement('tbody');
  tbl.appendChild(tbody);
  el.appendChild(tbl);

  function updateIndicators(): void {
    headerCells.forEach((th, i) => {
      th.textContent = cols[i] + (i === sortCol ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
    });
  }

  function renderBody(): void {
    tbody.innerHTML = '';
    for (const row of rows) {
      if (filterText && !row.some(cell => String(cell ?? '').toLowerCase().includes(filterText))) continue;
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
  }

  renderBody();
  return el;
}
