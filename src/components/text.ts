import type { RendererContext } from '../types.js';
import type { Text } from '../types.js';

export function renderText(spec: Text, _ctx: RendererContext): HTMLElement {
  const v = spec.variant ?? 'body';
  const el = document.createElement(v === 'heading' ? 'h2' : 'div');
  el.className = `exd-text-${v}`;
  el.textContent = spec.text;
  return el;
}
