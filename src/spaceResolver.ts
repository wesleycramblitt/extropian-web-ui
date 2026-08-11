// Maps SceneNode.space references to CSS coordinate transforms.
// For DOM-based rendering, spaces affect layout (position, size,
// overflow behavior) rather than actual 3D transforms.
import type { Space, SpaceLayout, SceneNode } from './types.js';

export interface ResolvedSpace {
  id: string;
  type: string;
  cssPosition: 'relative' | 'absolute' | 'static';
  cssLeft: string;
  cssTop: string;
  cssWidth: string;
  cssHeight: string;
  cssBackground: string;
  cssOverflow: string;
  children: string[]; // space IDs that are parented to this space
}

/**
 * Build a resolved space map from the document's space definitions.
 * Screen space is always the root (position: static, full width).
 * Panel spaces get relative positioning; overlays get absolute.
 */
export function resolveSpaces(spaces: Space[]): Map<string, ResolvedSpace> {
  const map = new Map<string, ResolvedSpace>();

  // First pass: create all resolved spaces
  for (const sp of spaces) {
    const layout = sp.layout;
    map.set(sp.id, {
      id: sp.id,
      type: sp.type,
      cssPosition: spaceToCssPosition(sp.type),
      cssLeft: layout?.x ?? '0',
      cssTop: layout?.y ?? '0',
      cssWidth: layout?.width ?? (sp.type === 'screen' ? '100%' : 'auto'),
      cssHeight: layout?.height ?? (sp.type === 'screen' ? '100%' : 'auto'),
      cssBackground: sp.background,
      cssOverflow: sp.scroll ? 'auto' : 'visible',
      children: [],
    });
  }

  // Second pass: build parent→child relationships
  for (const sp of spaces) {
    if (sp.parent) {
      const parent = map.get(sp.parent);
      if (parent) {
        parent.children.push(sp.id);
      }
    }
  }

  return map;
}

function spaceToCssPosition(type: string): 'relative' | 'absolute' | 'static' {
  switch (type) {
    case 'screen': return 'static';
    case 'overlay': return 'absolute';
    case 'viewport3d': return 'absolute';
    default: return 'relative';
  }
}

/**
 * Resolve which space a node belongs to and return the space definition.
 */
export function getSpaceForNode(
  node: SceneNode,
  spaces: Map<string, ResolvedSpace>,
): ResolvedSpace | undefined {
  return spaces.get(node.space);
}

/**
 * Create a CSS-transformed container for a space.
 * For DOM rendering, this creates a positioned div that mirrors the space layout.
 */
export function createSpaceContainer(
  space: ResolvedSpace,
  _allSpaces: Map<string, ResolvedSpace>,
): HTMLElement {
  const el = document.createElement('div');
  el.className = `exd-space exd-space-${space.type}`;
  el.setAttribute('data-space-id', space.id);
  el.style.position = space.cssPosition;
  el.style.left = space.cssLeft;
  el.style.top = space.cssTop;
  el.style.width = space.cssWidth;
  el.style.height = space.cssHeight;
  el.style.background = space.cssBackground;
  el.style.overflow = space.cssOverflow;
  el.style.boxSizing = 'border-box';

  // Panel spaces get a dark theme border-radius and padding
  if (space.type === 'panel') {
    el.style.borderRadius = '8px';
    el.style.border = '1px solid #2a2a4a';
    el.style.padding = '16px';
  }

  // Overlay spaces get z-index boost
  if (space.type === 'overlay') {
    el.style.zIndex = '10';
    el.style.pointerEvents = 'none'; // overlays should not block clicks on base
  }

  return el;
}

/**
 * Walk nodes and return them grouped by space.
 */
export function groupNodesBySpace(nodes: SceneNode[]): Map<string, SceneNode[]> {
  const groups = new Map<string, SceneNode[]>();

  function walk(nodeList: SceneNode[]): void {
    for (const node of nodeList) {
      const spaceId = node.space;
      let group = groups.get(spaceId);
      if (!group) {
        group = [];
        groups.set(spaceId, group);
      }
      group.push(node);
      // Recurse into children (they might be in different spaces)
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return groups;
}
