// Example SceneDocuments demonstrating the diagram vocabulary (shapes, edges,
// encoding, layout, legend). These are reference fixtures for the v1 prototype
// and hand-authored examples of the compiler's output shape.
import type { SceneDocument, SceneNode, NodeType, NodeInteraction, NodeStyle, NodeSemantic, SceneRelation } from './types.js';

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

// ── CHAMPS UI — codebase overview ───────────────────────────────────────────

type RoleId = 'foundation' | 'substrate' | 'services' | 'ui' | 'entry';

interface ModuleInfo {
  id: string;
  label: string;
  role: RoleId;
  loc: number;
  desc: string;
}

const CHAMPS_MODULES: ModuleInfo[] = [
  { id: 'core', label: 'core', role: 'foundation', loc: 249, desc: 'Foundation — callbacks, app context, core types (header-only interface library).' },
  { id: 'gl', label: 'gl', role: 'substrate', loc: 1595, desc: 'OpenGL wrappers — shader programs and GPU mesh upload (1,595 LOC).' },
  { id: 'scene', label: 'scene', role: 'substrate', loc: 576, desc: 'CPU-side mesh data, shape primitives, VTK loader (576 LOC).' },
  { id: 'ipc', label: 'ipc', role: 'substrate', loc: 541, desc: 'File-based inter-process communication channel (541 LOC).' },
  { id: 'solver', label: 'solver', role: 'services', loc: 3426, desc: 'Solver process management + SDF generation, Qt-free (3,426 LOC).' },
  { id: 'state', label: 'state', role: 'services', loc: 7104, desc: 'Application state — scene tree, undoable commands, node-type handlers (7,104 LOC).' },
  { id: 'viewport', label: 'viewport', role: 'ui', loc: 7485, desc: '3D viewport — 7 render passes, GPU picking, 9 gizmos (7,485 LOC).' },
  { id: 'gui', label: 'gui', role: 'ui', loc: 6438, desc: 'Qt6 widgets — main window, panels, controllers, styles (6,438 LOC).' },
  { id: 'app', label: 'Champs_UI', role: 'entry', loc: 94, desc: 'Executable entry point — registers everything (94 LOC).' },
];

// dependency → dependant ("core is a dependency of gl") — reads foundation → app left-to-right
const CHAMPS_DEPENDENCIES: [string, string][] = [
  ['core', 'gl'], ['core', 'scene'], ['core', 'ipc'],
  ['core', 'solver'], ['core', 'viewport'], ['core', 'state'],
  ['core', 'gui'], ['core', 'app'],
  ['ipc', 'solver'],
  ['gl', 'viewport'], ['scene', 'viewport'],
  ['solver', 'state'], ['scene', 'state'], ['viewport', 'state'], ['ipc', 'state'],
  ['state', 'gui'], ['viewport', 'gui'],
  ['gui', 'app'], ['state', 'app'], ['viewport', 'app'], ['ipc', 'app'], ['solver', 'app'],
];

function moduleSemantic(m: ModuleInfo): NodeSemantic {
  return { role: m.role, concept_id: m.id, kind: 'module', explanation: m.desc, tags: [m.role] };
}

/**
 * CHAMPS UI — a whole codebase in one document. Two views of the same data:
 *   · a treemap where area = lines of code and color = role (module size),
 *   · a layered dependency graph where shape + color = role (architecture).
 * Demonstrates size/color/shape/label encodings, treemap + layered layouts,
 * relations, a shared ordinal scale + legend, and semantic context per module.
 */
export const champsUiExample: SceneDocument = (() => {
  const treemapNodes = CHAMPS_MODULES.map(m => n(m.id, 'Shape', 'modules', {
    geometry: { shape: 'Rect' },
    content: { label: m.label },
    semantic: moduleSemantic(m),
    encode: { color: { source: 'role', scale: 'role' } },
  }));

  const depNodes = CHAMPS_MODULES.map(m => n(`${m.id}_dep`, 'Shape', 'deps', {
    content: { label: m.label },
    semantic: moduleSemantic(m),
    encode: {
      color: { source: 'role', scale: 'role' },
      shape: { source: 'role', scale: 'shape' },
    },
  }));

  const relations: SceneRelation[] = CHAMPS_DEPENDENCIES.map(([dep, use]) => ({
    id: `${dep}->${use}`,
    source: `${dep}_dep`,
    target: `${use}_dep`,
    style: { type: 'arrow', color: '#4a9eff', width: 1.5, dash: false },
    semantic: { kind: 'dependency' },
  }));

  const loc: Record<string, number> = {};
  const role: Record<string, string> = {};
  for (const m of CHAMPS_MODULES) {
    for (const suffix of ['', '_dep']) {
      loc[m.id + suffix] = m.loc;
      role[m.id + suffix] = m.role;
    }
  }

  return {
    version: 1,
    topic: 'CHAMPS UI — codebase overview',
    spaces: [
      { id: 'screen', type: 'screen', projection: 'orthographic', background: '#0a0a1a', scroll: true },
      {
        id: 'modules', type: 'cartesian2d', projection: 'orthographic', background: '#0e0e2a', scroll: false,
        layout: { x: '0', y: '0', width: '900', height: '480' },
        arrangement: { algorithm: 'treemap', size_by: { source: 'loc' }, params: { padding: 4 } },
      },
      {
        id: 'deps', type: 'cartesian2d', projection: 'orthographic', background: '#0e0e2a', scroll: false,
        layout: { x: '0', y: '0', width: '900', height: '520' },
        arrangement: { algorithm: 'layered', params: { rankdir: 'LR', gap: 40, node_width: 120, node_height: 48 } },
      },
    ],
    scales: [
      { id: 'role', type: 'ordinal', scheme: '', domain: ['foundation', 'substrate', 'services', 'ui', 'entry'], range: ['#8c8c9a', '#2ca02c', '#ff7f0e', '#1f77b4', '#d62728'] },
      { id: 'shape', type: 'ordinal', scheme: '', domain: ['foundation', 'substrate', 'services', 'ui', 'entry'], range: ['Rect', 'Hexagon', 'Cylinder', 'RoundedRect', 'Diamond'] },
    ],
    nodes: [
      n('title', 'Text', 'screen', { geometry: { variant: 'heading' }, content: { text: 'CHAMPS UI — hypersonic CFD frontend' } }),
      n('subtitle', 'Text', 'screen', { content: { text: 'Cross-platform Qt6 · C++20 · OpenGL 4.3+ · Eigen3 — 9 modules, ~27.5k LOC, 11 GLSL shaders, 7 render passes.' } }),
      ...treemapNodes,
      ...depNodes,
      n('legend', 'Legend', 'screen', { content: { scale: 'role', title: 'Module role' } }),
    ],
    relations,
    state: {},
    data_sources: { loc, role },
  };
})();
