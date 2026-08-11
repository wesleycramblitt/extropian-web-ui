// Image renderer — renders SceneNode with type 'Image'.
// Handles content.src, content.alt, geometry.width, geometry.height, geometry.fit.
import type { SceneNode, RendererContext } from '../types.js';

export function renderImage(node: SceneNode, _ctx: RendererContext): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'exd-image-wrapper';

  const src = String(node.content.src ?? '');
  const alt = String(node.content.alt ?? '');
  const caption = String(node.content.caption ?? '');
  const width = toNum(node.geometry.width, 200);
  const height = toNum(node.geometry.height, 200);
  const fit = String(node.geometry.fit ?? 'contain');

  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    width: ${typeof node.geometry.width === 'string' ? node.geometry.width : width + 'px'};
    max-width: 100%;
  `;

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.className = 'exd-image';
  img.style.cssText = `
    display: block;
    width: 100%;
    height: ${height}px;
    object-fit: ${fit};
    border-radius: ${toNum(node.geometry.cornerRadius, 0)}px;
  `;
  img.setAttribute('loading', 'lazy');

  wrapper.appendChild(img);

  if (caption) {
    const cap = document.createElement('div');
    cap.className = 'exd-image-caption';
    cap.textContent = caption;
    cap.style.cssText = `
      font-size: 11px;
      color: #8080b0;
      margin-top: 6px;
      text-align: center;
    `;
    wrapper.appendChild(cap);
  }

  return wrapper;
}

function toNum(v: unknown, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return fallback;
}
