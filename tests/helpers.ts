import type { SceneDocument, SceneNode, NodeType } from '../src/types.js';

export function container(): HTMLElement {
  return document.createElement('div');
}

export function baseDoc(): SceneDocument {
  return {
    version: 1,
    topic: 'test',
    spaces: [{ id: 'screen', type: 'screen', projection: 'orthographic', background: '#0a0a1a', scroll: true }],
    nodes: [],
    relations: [],
    state: {},
    data_sources: {},
  };
}

/** Minimal valid SceneNode with sensible defaults for every required field. */
export function node(partial: Partial<SceneNode> & { id: string; type: NodeType }): SceneNode {
  return {
    space: 'screen',
    interaction: { hover: false, select: false, drag: false, focus: false, inspect: false, edit: false },
    style: { emphasis: 'default', opacity: 1, depth: 0, visible: true },
    geometry: {},
    content: {},
    children: [],
    ...partial,
  };
}
