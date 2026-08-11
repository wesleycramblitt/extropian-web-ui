import type { RendererContext } from '../types.js';
import type { Button } from '../types.js';

export function renderButton(spec: Button, ctx: RendererContext): HTMLElement {
  const el = document.createElement('button');
  el.className = 'exd-button';
  el.textContent = spec.label;

  el.addEventListener('click', () => {
    const action = spec.action ?? 'button:click';
    ctx.emit(action, { label: spec.label });
  });

  return el;
}
