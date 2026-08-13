// Example SceneDocuments demonstrating the diagram vocabulary (shapes, edges,
// encoding, layout, legend). These are reference fixtures for the v1 prototype
// and hand-authored examples of the compiler's output shape.
import type { SceneDocument, SceneNode, NodeType, NodeInteraction, NodeStyle } from './types.js';

const INTERACTION: NodeInteraction = { hover: true, select: true, drag: false, focus: true, inspect: true, edit: false };
const STYLE: NodeStyle = { emphasis: 'default', opacity: 1, depth: 0, visible: true };

function n(id: string, type: NodeType, space: string, partial: Partial<SceneNode> = {}): SceneNode {
  return { id, type, space, interaction: INTERACTION, style: STYLE, geometry: {}, content: {}, children: [], ...partial };
}

/**
 * A codebase "module map": a squarified treemap where box area = code size and
 * fill color = cyclomatic complexity (via a shared `complexity` scale + legend).
 * Relations show module dependencies. Demonstrates shapes + encoding + layout
 * + legend + edge routing in one document.
 */
export const codebaseMapExample: SceneDocument = {
  version: 1,
  topic: 'Codebase module map',
  spaces: [
    { id: 'screen', type: 'screen', projection: 'orthographic', background: '#0a0a1a', scroll: true },
    {
      id: 'modules',
      type: 'cartesian2d',
      projection: 'orthographic',
      background: '#0e0e2a',
      scroll: false,
      layout: { x: '0', y: '0', width: '800', height: '460' },
      arrangement: { algorithm: 'treemap', size_by: { source: 'code_size' }, params: { padding: 4 } },
    },
  ],
  scales: [
    { id: 'complexity', type: 'linear', scheme: 'viridis', domain: [0, 100], range: [] },
  ],
  nodes: [
    n('title', 'Text', 'screen', { geometry: { variant: 'heading' }, content: { text: 'Module map — area = code size, color = complexity' } }),
    n('core', 'Shape', 'modules', {
      geometry: { shape: 'RoundedRect' },
      content: { label: 'core' },
      semantic: { role: 'module', concept_id: 'core', kind: 'module', explanation: 'Kernel module', tags: ['core'] },
      encode: { color: { source: 'complexity', scale: 'complexity' } },
    }),
    n('ui', 'Shape', 'modules', { geometry: { shape: 'RoundedRect' }, content: { label: 'ui' }, encode: { color: { source: 'complexity', scale: 'complexity' } } }),
    n('net', 'Shape', 'modules', { geometry: { shape: 'RoundedRect' }, content: { label: 'net' }, encode: { color: { source: 'complexity', scale: 'complexity' } } }),
    n('db', 'Shape', 'modules', { geometry: { shape: 'RoundedRect' }, content: { label: 'db' }, encode: { color: { source: 'complexity', scale: 'complexity' } } }),
    n('util', 'Shape', 'modules', { geometry: { shape: 'RoundedRect' }, content: { label: 'util' }, encode: { color: { source: 'complexity', scale: 'complexity' } } }),
    n('legend', 'Legend', 'screen', { content: { scale: 'complexity', title: 'Cyclomatic complexity' } }),
  ],
  relations: [
    { id: 'ui-core', source: 'ui', target: 'core', style: { type: 'arrow', color: '#4a9eff', width: 2, dash: false }, semantic: { kind: 'depends_on' } },
    { id: 'net-core', source: 'net', target: 'core', style: { type: 'arrow', color: '#4a9eff', width: 2, dash: false }, semantic: { kind: 'depends_on' } },
    { id: 'db-core', source: 'db', target: 'core', style: { type: 'arrow', color: '#4a9eff', width: 2, dash: false }, semantic: { kind: 'depends_on' } },
  ],
  state: {},
  data_sources: {
    code_size: { core: 340, ui: 220, net: 160, db: 190, util: 90 },
    complexity: { core: 92, ui: 38, net: 71, db: 55, util: 18 },
  },
};

/** A layered neural-network diagram: nodes in ranks, edges as data flow. */
export const neuralNetExample: SceneDocument = {
  version: 1,
  topic: 'Neural network (forward pass)',
  spaces: [
    { id: 'screen', type: 'screen', projection: 'orthographic', background: '#0a0a1a', scroll: true },
    {
      id: 'net',
      type: 'cartesian2d',
      projection: 'orthographic',
      background: '#0e0e2a',
      scroll: false,
      layout: { x: '0', y: '0', width: '720', height: '360' },
      arrangement: { algorithm: 'layered', params: { rankdir: 'LR', gap: 48, node_width: 90, node_height: 44 } },
    },
  ],
  scales: [],
  nodes: [
    n('title', 'Text', 'screen', { geometry: { variant: 'heading' }, content: { text: 'Forward pass — layers left to right' } }),
    n('input', 'Shape', 'net', { geometry: { shape: 'Circle' }, content: { label: 'input' } }),
    n('hidden1', 'Shape', 'net', { geometry: { shape: 'Circle' }, content: { label: 'h1' } }),
    n('hidden2', 'Shape', 'net', { geometry: { shape: 'Circle' }, content: { label: 'h2' } }),
    n('output', 'Shape', 'net', { geometry: { shape: 'Circle' }, content: { label: 'output' } }),
  ],
  relations: [
    { id: 'i-h1', source: 'input', target: 'hidden1', style: { type: 'arrow', color: '#4a9eff', width: 2, dash: false }, label: { text: 'W1', position: 'middle' } },
    { id: 'h1-h2', source: 'hidden1', target: 'hidden2', style: { type: 'arrow', color: '#4a9eff', width: 2, dash: false }, label: { text: 'W2', position: 'middle' } },
    { id: 'h2-o', source: 'hidden2', target: 'output', style: { type: 'arrow', color: '#4a9eff', width: 2, dash: false }, label: { text: 'W3', position: 'middle' } },
  ],
  state: {},
  data_sources: {},
};
