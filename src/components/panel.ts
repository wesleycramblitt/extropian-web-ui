import type { RendererContext } from '../types.js';
import type { Panel } from '../types.js';

export function renderPanel(spec: Panel, ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = `exd-panel exd-panel-${spec.layout ?? 'column'}`;

  if (spec.layout === 'grid' && spec.cols) {
    el.style.gridTemplateColumns = `repeat(${spec.cols}, 1fr)`;
    el.style.display = 'grid';
  }

  // Title
  if (spec.title) {
    const title = document.createElement('div');
    title.className = 'exd-panel-title';
    title.textContent = spec.title;
    el.appendChild(title);
  }

  // Children
  for (const child of spec.children ?? []) {
    const childEl = ctx.render(child);
    el.appendChild(childEl);
  }

  return el;
}
