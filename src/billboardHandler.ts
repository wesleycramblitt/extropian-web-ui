// BillboardHandler — handles node.orient.mode for 2D billboarding.
// In the DOM path, "billboard" means the element always faces the viewer,
// which for 2D is a no-op (everything faces the viewer by default).
// "billboard_y" means rotation around the Y axis only, also no-op in 2D.
//
// These are provided as stubs for interface parity with the C++/OpenGL
// backend. When the WASM 3D viewport is enabled (v0.2), billboard transforms
// will emit CSS 3D transforms here.
import type { SceneNode, Orient } from './types.js';

export type BillboardMode = Orient['mode'];

/**
 * Determine the CSS transform class for a node's orient mode.
 * Returns a CSS class name that can be added to the element.
 * In 2D DOM rendering, most billboard modes are identity.
 */
export function billboardCssClass(mode: BillboardMode | undefined): string {
  if (!mode) return '';
  switch (mode) {
    case 'fixed':     return 'exd-orient-fixed';
    case 'billboard': return 'exd-orient-billboard';
    case 'billboard_y': return 'exd-orient-billboard-y';
  }
}

/**
 * Determine if a node should have a transform applied for its orient.
 * For DOM rendering (v0.1), billboarding is a no-op — elements always
 * face the viewer. Returns null for no-op.
 */
export function billboardTransform(
  orient: Orient | undefined,
  _cameraDirection?: [number, number, number],
): string | null {
  if (!orient || orient.mode === 'fixed') return null;
  // In 2D DOM, billboard and billboard_y are identity transforms.
  // In v0.2, we'd compute a CSS transform matrix based on camera angle.
  return null;
}

/**
 * Apply billboard-related CSS to a DOM element.
 */
export function applyBillboard(
  el: HTMLElement,
  node: SceneNode,
): void {
  if (!node.orient) return;

  const cls = billboardCssClass(node.orient.mode);
  if (cls) el.classList.add(cls);

  const transform = billboardTransform(node.orient);
  if (transform) {
    el.style.transform = transform;
  }
}
