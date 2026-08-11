import type { RendererContext } from '../types.js';
import type { ViewRef } from '../types.js';

/**
 * A view_ref node renders as a placeholder. The layout engine resolves
 * view references when it encounters them in the layout tree.
 * In a flat Visual tree, a view_ref renders an error placeholder.
 */
export function renderViewRef(spec: ViewRef, _ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-error';
  el.style.padding = '8px 12px';
  el.textContent = `[view_ref → "${spec.view}" — use a layout tree to resolve]`;
  return el;
}
