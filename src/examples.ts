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

// ── CHAMPS UI — deep-dive (stress-test of information density) ──────────────
//
// Same codebase, 10× the information: three views (treemap by LOC, layered
// dependency graph, and a nested 3-level hierarchy tree), four encodings
// (size, color, shape, opacity), a summary panel with a sortable table,
// annotations, and rich per-node semantic explanations.

interface Subcomponent {
  id: string;
  label: string;
  desc: string;
  children?: Subcomponent[];
}

interface DeepModule {
  id: string;
  label: string;
  role: RoleId;
  cxx: number;
  h: number;
  shaders: number;
  summary: string;
  detail: string;
  abstractions: string;
  children: Subcomponent[];
}

const DEEP_MODULES: DeepModule[] = [
  {
    id: 'core', label: 'core', role: 'foundation', cxx: 0, h: 249, shaders: 0,
    summary: 'Header-only foundation · 249 LOC',
    detail: 'Core types, callback_list, and app_context. An INTERFACE library — headers only, no compilation unit. The single dependency root for every other module.',
    abstractions: 'callback_list, app_context',
    children: [
      { id: 'core-cb', label: 'callback_list', desc: 'Observable callback lists' },
      { id: 'core-ctx', label: 'app_context', desc: 'Shared application context' },
    ],
  },
  {
    id: 'gl', label: 'gl', role: 'substrate', cxx: 1271, h: 324, shaders: 0,
    summary: 'OpenGL wrappers · 1,595 LOC',
    detail: 'Low-level OpenGL wrappers: shader program management and GPU mesh upload. Depends on cui_core, Eigen3, and Qt6::OpenGL.',
    abstractions: 'shader program, gpu mesh',
    children: [
      { id: 'gl-sh', label: 'shader_program', desc: 'Shader compile/link' },
      { id: 'gl-mesh', label: 'gpu_mesh', desc: 'VBO/VAO upload' },
    ],
  },
  {
    id: 'scene', label: 'scene', role: 'substrate', cxx: 290, h: 286, shaders: 0,
    summary: 'Scene graph data · 576 LOC',
    detail: 'CPU-side mesh data, shape primitives, and a VTK loader. The shared data model between state and viewport.',
    abstractions: 'shape::packet, mesh data',
    children: [
      { id: 'scene-shape', label: 'shape', desc: 'shape::packet type-erased shapes' },
      { id: 'scene-vtk', label: 'vtk_loader', desc: 'VTK mesh import' },
    ],
  },
  {
    id: 'ipc', label: 'ipc', role: 'substrate', cxx: 285, h: 256, shaders: 0,
    summary: 'File IPC · 541 LOC',
    detail: 'File-based inter-process communication channel that polls the solver run directory. Uses fmt + spdlog.',
    abstractions: 'file_ipc_channel',
    children: [
      { id: 'ipc-file', label: 'file_ipc_channel', desc: 'Poll run directory for messages' },
    ],
  },
  {
    id: 'solver', label: 'solver', role: 'services', cxx: 1443, h: 1983, shaders: 0,
    summary: 'Solver client · 3,426 LOC',
    detail: 'Qt-free solver process management: SDF generation and rendering, with local and SSH process transports.',
    abstractions: 'sdf_generator, local/ssh transport',
    children: [
      {
        id: 'solver-sdf', label: 'sdf', desc: 'SDF format, generator, renderer',
        children: [
          { id: 'solver-sdf-fmt', label: 'sdf_fmt', desc: 'SDF format helpers' },
          { id: 'solver-sdf-gen', label: 'sdf_generator', desc: 'Scene tree → SDF' },
          { id: 'solver-sdf-render', label: 'sdf_renderer', desc: 'SDF → geometry' },
        ],
      },
      {
        id: 'solver-transport', label: 'transport', desc: 'Process transports',
        children: [
          { id: 'solver-local', label: 'local_process', desc: 'Local process transport' },
          { id: 'solver-ssh', label: 'ssh_process', desc: 'SSH remote transport' },
        ],
      },
    ],
  },
  {
    id: 'state', label: 'state', role: 'services', cxx: 4160, h: 2944, shaders: 0,
    summary: 'App state · 7,104 LOC',
    detail: 'The application state layer: a flat scene tree with a node-type registry, pluggable Inode_type_handler, an undoable Icommand system, and an async command_bus.',
    abstractions: 'scene_tree, Icommand, command_bus, Inode_type_handler',
    children: [
      { id: 'state-tree', label: 'scene_tree', desc: 'Flat node list + registry' },
      { id: 'state-node', label: 'scene_node', desc: 'Node + type schema' },
      { id: 'state-cmd', label: 'commands', desc: 'Undoable Icommand set' },
      { id: 'state-nt', label: 'node_types', desc: 'Concrete node defs + handlers' },
    ],
  },
  {
    id: 'viewport', label: 'viewport', role: 'ui', cxx: 5452, h: 1902, shaders: 131,
    summary: '3D viewport · 7,485 LOC + 131 shader lines',
    detail: 'The 3D viewport: a 7-pass render pipeline, GPU triangle picking, an orbit camera, and 9 interactive gizmos. Owns 11 GLSL shaders.',
    abstractions: 'Igizmo, scene_manager, pick_system, orbit_camera',
    children: [
      {
        id: 'vp-render', label: 'renderers', desc: '7 render passes',
        children: [
          { id: 'vp-bg', label: 'background_renderer', desc: 'Gradient pass' },
          { id: 'vp-scene', label: 'scene_renderer', desc: 'SSBO mesh pass' },
          { id: 'vp-shape', label: 'shape_drawer', desc: 'Node shapes + hover' },
          { id: 'vp-toggle', label: 'display_toggle_renderer', desc: 'Wireframe/grid/axes' },
        ],
      },
      {
        id: 'vp-gizmo', label: 'gizmos', desc: '9 interactive manipulators',
        children: [
          { id: 'vp-axis', label: 'axis_gizmo', desc: 'Translate axis' },
          { id: 'vp-scale', label: 'scale_gizmo', desc: 'Uniform scale' },
          { id: 'vp-ring', label: 'rotation_ring_gizmo', desc: 'Rotate ring' },
          { id: 'vp-bbox', label: 'bounding_box_gizmo', desc: 'Selection box' },
        ],
      },
      { id: 'vp-cam', label: 'orbit_camera', desc: 'Azimuth/elevation camera' },
      { id: 'vp-pick', label: 'pick_system', desc: 'GPU triangle picking' },
      { id: 'vp-mgr', label: 'scene_manager', desc: 'CPU/GPU mesh cache' },
    ],
  },
  {
    id: 'gui', label: 'gui', role: 'ui', cxx: 4869, h: 1569, shaders: 0,
    summary: 'Qt6 widgets · 6,438 LOC',
    detail: 'The Qt6 UI: main window, docked panels, dialogs, MVC controllers (tree, viewport, solver, console, script, menu), a QSS stylesheet pipeline, and custom widgets.',
    abstractions: 'controllers, panels, widgets, style',
    children: [
      {
        id: 'gui-ctrl', label: 'controllers', desc: 'MVC controllers',
        children: [
          { id: 'gui-tree', label: 'tree', desc: 'Scene tree controller' },
          { id: 'gui-vp', label: 'viewport', desc: 'Viewport controller' },
          { id: 'gui-solver', label: 'solver', desc: 'Solver run controller' },
          { id: 'gui-console', label: 'console_log', desc: 'Log panel controller' },
        ],
      },
      { id: 'gui-panels', label: 'panels', desc: 'Docked panel sections' },
      { id: 'gui-widgets', label: 'widgets', desc: 'Custom widgets' },
      { id: 'gui-style', label: 'style', desc: 'QSS pipeline + palette' },
    ],
  },
  {
    id: 'app', label: 'Champs_UI', role: 'entry', cxx: 94, h: 0, shaders: 0,
    summary: 'Entry point · 94 LOC',
    detail: 'The executable entry point — registers everything and starts the Qt event loop.',
    abstractions: 'main',
    children: [
      { id: 'app-main', label: 'main.cxx', desc: 'Registers types + starts app' },
    ],
  },
];

const locOf = (m: DeepModule): number => m.cxx + m.h + m.shaders;
const hdrOf = (m: DeepModule): number => (m.cxx + m.h) > 0 ? Math.round((m.h / (m.cxx + m.h)) * 100) / 100 : 0;

function semanticFor(id: string, role: string, explanation: string, tags?: string[]): NodeSemantic {
  return { role, concept_id: id, kind: 'module', explanation, tags: tags ?? [role] };
}

export const champsUiDeepExample: SceneDocument = (() => {
  // View 1 — treemap: area = LOC, color = role, opacity = header ratio
  const treemapNodes = DEEP_MODULES.map(m => n(m.id, 'Shape', 'modules', {
    geometry: { shape: 'Rect' },
    content: { label: m.label },
    semantic: semanticFor(m.id, m.role, `${m.summary}. ${m.detail} (${m.abstractions})`),
    encode: { color: { source: 'role', scale: 'role' }, opacity: { source: 'hdr', scale: 'hdr' } },
  }));

  // View 2 — layered dependency graph: shape = role, color = role
  const depNodes = DEEP_MODULES.map(m => n(`${m.id}_dep`, 'Shape', 'deps', {
    content: { label: m.label },
    semantic: semanticFor(m.id, m.role, `${m.summary}. ${m.detail}`),
    encode: { color: { source: 'role', scale: 'role' }, shape: { source: 'role', scale: 'shape' } },
  }));

  const relations: SceneRelation[] = CHAMPS_DEPENDENCIES.map(([dep, use]) => ({
    id: `${dep}->${use}`,
    source: `${dep}_dep`,
    target: `${use}_dep`,
    style: { type: 'arrow', color: '#4a9eff', width: 1.5, dash: false },
    semantic: { kind: 'dependency' },
  }));

  // View 3 — hierarchy tree: nested module → subcomponent → leaf
  function buildSubNode(c: Subcomponent, role: RoleId): SceneNode {
    return n(c.id, 'Shape', 'hierarchy', {
      geometry: { shape: c.children?.length ? 'Rect' : 'Circle' },
      content: { label: c.label },
      semantic: semanticFor(c.id, role, c.desc),
      encode: { color: { source: 'role', scale: 'role' } },
      children: (c.children ?? []).map(g => buildSubNode(g, role)),
    });
  }
  const hierarchyNodes = DEEP_MODULES.map(m => n(`${m.id}_t`, 'Shape', 'hierarchy', {
    geometry: { shape: 'RoundedRect' },
    content: { label: m.label },
    semantic: semanticFor(m.id, m.role, m.detail),
    encode: { color: { source: 'role', scale: 'role' } },
    children: (m.children ?? []).map(c => buildSubNode(c, m.role)),
  }));

  // Summary table (sortable + striped)
  const tableRows = DEEP_MODULES.map(m => [m.label, String(locOf(m)), m.role, `${Math.round(hdrOf(m) * 100)}%`]);

  // data_sources: role for every node id; loc + hdr for module ids
  const role: Record<string, string> = {};
  const loc: Record<string, number> = {};
  const hdr: Record<string, number> = {};
  for (const m of DEEP_MODULES) {
    for (const suffix of ['', '_dep', '_t']) role[m.id + suffix] = m.role;
    loc[m.id] = locOf(m);
    loc[`${m.id}_dep`] = locOf(m);
    hdr[m.id] = hdrOf(m);
    const walk = (subs: Subcomponent[]): void => { for (const s of subs) { role[s.id] = m.role; walk(s.children ?? []); } };
    walk(m.children);
  }

  return {
    version: 1,
    topic: 'CHAMPS UI — deep-dive',
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
      {
        id: 'hierarchy', type: 'cartesian2d', projection: 'orthographic', background: '#0e0e2a', scroll: false,
        layout: { x: '0', y: '0', width: '1100', height: '720' },
        arrangement: { algorithm: 'tree', params: { orientation: 'vertical', node_width: 130, node_height: 40 } },
      },
    ],
    scales: [
      { id: 'role', type: 'ordinal', scheme: '', domain: ['foundation', 'substrate', 'services', 'ui', 'entry'], range: ['#8c8c9a', '#2ca02c', '#ff7f0e', '#1f77b4', '#d62728'] },
      { id: 'shape', type: 'ordinal', scheme: '', domain: ['foundation', 'substrate', 'services', 'ui', 'entry'], range: ['Rect', 'Hexagon', 'Cylinder', 'RoundedRect', 'Diamond'] },
      { id: 'hdr', type: 'linear', scheme: '', domain: [0, 1], range: [0.3, 1] },
    ],
    nodes: [
      n('title', 'Text', 'screen', { geometry: { variant: 'heading' }, content: { text: 'CHAMPS UI — deep-dive (3 views, 4 encodings)' } }),
      n('subtitle', 'Text', 'screen', { content: { text: 'Treemap: area = LOC, color = role, opacity = header ratio. Layered graph: shape + color = role. Tree: nested module → subcomponent → file. Hover or click any node for its full description.' } }),
      // Summary panel: prose + sortable table
      n('summary', 'Panel', 'screen', {
        content: { title: 'Module summary' },
        layout: { strategy: 'column', gap: 8, padding: 12, alignment: 'start' },
        children: [
          n('summary-text', 'Text', 'screen', { content: { text: '9 modules · ~27.5k LOC C++20 · 131 GLSL shader lines. Largest: viewport (7,485), state (7,104), gui (6,438). Header ratio: core 100% (header-only) → app 0%.' } }),
          n('summary-table', 'Table', 'screen', {
            geometry: { sortable: true, striped: true, maxHeight: 280 },
            content: { columns: ['module', 'LOC', 'role', 'header %'], rows: tableRows },
          }),
        ],
      }),
      ...treemapNodes,
      ...depNodes,
      ...hierarchyNodes,
      n('legend', 'Legend', 'screen', { content: { scale: 'role', title: 'Module role' } }),
    ],
    relations,
    presentation: {
      selection: [],
      overrides: {},
      annotations: [
        { id: 'ann-vp', target: 'viewport', text: '7 render passes · 9 gizmos · 11 shaders', position: 'below', style: 'callout' },
        { id: 'ann-state', target: 'state', text: 'undoable Icommand + async command_bus', position: 'below', style: 'callout' },
        { id: 'ann-solver', target: 'solver', text: 'SSH + local process transport', position: 'below', style: 'callout' },
      ],
      animations: [],
    },
    state: {},
    data_sources: { loc, role, hdr },
  };
})();

// ── CUDA — how a GPU program executes ───────────────────────────────────────
//
// Explains the CUDA programming model in one document: the grid→block→thread
// hierarchy as nested containers, the host/device data flow as a swimlane, the
// memory hierarchy as a layered diagram, plus an index formula and summary.

export const cudaExample: SceneDocument = (() => {
  // ── View 1: execution hierarchy (nested containers) ───────────────────────
  const threadsOf = (blockId: string, warp: boolean): SceneNode[] => {
    const ts: SceneNode[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        ts.push(n(`t-${blockId}-${r}-${c}`, 'Shape', 'hierarchy', {
          geometry: { shape: 'Rect', fill: warp ? '#ffd43b' : '#4a9eff' },
        }));
      }
    }
    return ts;
  };

  const blocks: SceneNode[] = [];
  for (let br = 0; br < 2; br++) {
    for (let bc = 0; bc < 2; bc++) {
      const id = `${br}-${bc}`;
      const isWarp = br === 0 && bc === 0;
      blocks.push(n(`block-${id}`, 'Shape', 'hierarchy', {
        geometry: { shape: 'RoundedRect' },
        content: { label: `block (${bc}, ${br})` },
        semantic: semanticFor(`block-${id}`, 'block', 'A block of 32 threads scheduled on one SM; shares shared memory. blockIdx = this block\'s position in the grid.'),
        arrangement: { algorithm: 'grid', params: { cols: 8, gap: 2 } },
        children: threadsOf(id, isWarp),
      }));
    }
  }

  const gridNode = n('grid', 'Shape', 'hierarchy', {
    geometry: { shape: 'RoundedRect', width: 720, height: 420 },
    content: { label: 'grid — 2×2 blocks (gridDim)' },
    semantic: semanticFor('grid', 'grid', 'The whole kernel launch: a grid of blocks. gridDim = 2×2. Each block contains blockDim threads.'),
    arrangement: { algorithm: 'grid', params: { cols: 2, gap: 12 } },
    children: blocks,
  });

  // ── View 2: host ↔ device data flow (swimlane) ────────────────────────────
  const flowNode = (id: string, label: string, side: string, detail: string): SceneNode =>
    n(id, 'Shape', 'flow', {
      geometry: { shape: 'RoundedRect' },
      content: { label },
      semantic: semanticFor(id, side, detail),
      encode: { color: { source: 'side', scale: 'side' } },
    });

  const flowNodes = [
    flowNode('f-alloc', 'cudaMalloc', 'host', 'Allocate memory on the device (global memory).'),
    flowNode('f-memcpy-in', 'cudaMemcpy H→D', 'host', 'Copy input data from host RAM to device global memory.'),
    flowNode('f-kernel', 'kernel «grid, block»', 'device', 'Launch the kernel: the grid of blocks runs on the GPU.'),
    flowNode('f-memcpy-out', 'cudaMemcpy D→H', 'host', 'Copy the result back from device to host RAM.'),
  ];

  const flowRelations: SceneRelation[] = [
    { id: 'f1', source: 'f-alloc', target: 'f-memcpy-in', style: { type: 'arrow', color: '#4a9eff', width: 1.5, dash: false }, semantic: { kind: 'flows_to' } },
    { id: 'f2', source: 'f-memcpy-in', target: 'f-kernel', style: { type: 'arrow', color: '#4a9eff', width: 1.5, dash: false }, semantic: { kind: 'flows_to' } },
    { id: 'f3', source: 'f-kernel', target: 'f-memcpy-out', style: { type: 'arrow', color: '#4a9eff', width: 1.5, dash: false }, semantic: { kind: 'flows_to' } },
  ];

  // ── View 3: memory hierarchy (layered, color + shape by level) ────────────
  const memNode = (id: string, label: string, level: string, detail: string): SceneNode =>
    n(id, 'Shape', 'memory', {
      content: { label },
      semantic: semanticFor(id, level, detail),
      encode: { color: { source: 'level', scale: 'level' }, shape: { source: 'level', scale: 'memShape' } },
    });

  const memNodes = [
    memNode('mem-reg', 'registers\nper-thread · fastest', 'registers', 'Per-thread registers — the fastest memory, a few KB per SM, private to each thread.'),
    memNode('mem-shared', 'shared memory\nper-block · ~48 KB', 'shared', 'Shared memory — per block, used for thread cooperation within a block.'),
    memNode('mem-l2', 'L2 cache\nper-device', 'l2', 'L2 cache — shared across the whole device, between global memory and the SMs.'),
    memNode('mem-global', 'global DRAM\nslowest · GBs', 'global', 'Global memory — device DRAM, the largest and slowest level; accessible by all threads.'),
  ];

  const memRelations: SceneRelation[] = [
    { id: 'm1', source: 'mem-global', target: 'mem-l2', style: { type: 'arrow', color: '#8080b0', width: 1.5, dash: true }, semantic: { kind: 'hierarchy' } },
    { id: 'm2', source: 'mem-l2', target: 'mem-shared', style: { type: 'arrow', color: '#8080b0', width: 1.5, dash: true }, semantic: { kind: 'hierarchy' } },
    { id: 'm3', source: 'mem-shared', target: 'mem-reg', style: { type: 'arrow', color: '#8080b0', width: 1.5, dash: true }, semantic: { kind: 'hierarchy' } },
  ];

  // ── data_sources ──────────────────────────────────────────────────────────
  const side: Record<string, string> = {};
  for (const [id, s] of [['f-alloc', 'host'], ['f-memcpy-in', 'host'], ['f-kernel', 'device'], ['f-memcpy-out', 'host']] as const) side[id] = s;
  const level: Record<string, string> = { 'mem-reg': 'registers', 'mem-shared': 'shared', 'mem-l2': 'l2', 'mem-global': 'global' };

  return {
    version: 1,
    topic: 'How CUDA works',
    spaces: [
      { id: 'screen', type: 'screen', projection: 'orthographic', background: '#0a0a1a', scroll: true },
      {
        id: 'hierarchy', type: 'cartesian2d', projection: 'orthographic', background: '#0e0e2a', scroll: false,
        layout: { x: '0', y: '0', width: '760', height: '460' },
      },
      {
        id: 'flow', type: 'cartesian2d', projection: 'orthographic', background: '#0e0e2a', scroll: false,
        layout: { x: '0', y: '0', width: '860', height: '140' },
        arrangement: { algorithm: 'swimlane', lane_by: { source: 'side' }, params: { node_width: 170, node_height: 44, gap: 20 } },
      },
      {
        id: 'memory', type: 'cartesian2d', projection: 'orthographic', background: '#0e0e2a', scroll: false,
        layout: { x: '0', y: '0', width: '820', height: '220' },
        arrangement: { algorithm: 'layered', params: { rankdir: 'LR', gap: 60, node_width: 150, node_height: 90 } },
      },
    ],
    scales: [
      { id: 'side', type: 'ordinal', scheme: '', domain: ['host', 'device'], range: ['#1f77b4', '#d62728'] },
      { id: 'level', type: 'ordinal', scheme: '', domain: ['registers', 'shared', 'l2', 'global'], range: ['#2ca02c', '#1f77b4', '#ff7f0e', '#d62728'] },
      { id: 'memShape', type: 'ordinal', scheme: '', domain: ['registers', 'shared', 'l2', 'global'], range: ['Circle', 'RoundedRect', 'Hexagon', 'Cylinder'] },
    ],
    nodes: [
      n('title', 'Text', 'screen', { geometry: { variant: 'heading' }, content: { text: 'How CUDA works' } }),
      n('subtitle', 'Text', 'screen', { content: { text: 'A GPU program launches a kernel as a grid of blocks of threads. Hover or click any node for its explanation.' } }),
      n('summary', 'Panel', 'screen', {
        content: { title: 'Key idea' },
        layout: { strategy: 'column', gap: 8, padding: 12, alignment: 'start' },
        children: [
          n('summary-text', 'Text', 'screen', { content: { text: 'Host (CPU) copies data to device (GPU) memory, launches a kernel — a grid of blocks of threads — then copies results back. Threads run in warps of 32 in lockstep (SIMT). The grid/block/thread indices let every thread compute its own data element.' } }),
          n('index-eq', 'Equation', 'screen', { geometry: { display: true }, content: { source: '\\text{global index} = \\text{blockIdx.x} \\cdot \\text{blockDim.x} + \\text{threadIdx.x}' } }),
        ],
      }),
      n('hdr-hierarchy', 'Text', 'screen', { geometry: { variant: 'label' }, content: { text: 'Execution hierarchy — a grid of blocks, each block a grid of threads' } }),
      gridNode,
      ...flowNodes,
      ...memNodes,
      n('legend', 'Legend', 'screen', { content: { scale: 'level', title: 'Memory level' } }),
    ],
    relations: [...flowRelations, ...memRelations],
    presentation: {
      selection: [],
      overrides: {},
      annotations: [
        { id: 'ann-warp', target: 'block-0-0', text: '1 warp = 32 threads in lockstep (SIMT)', position: 'below', style: 'callout' },
        { id: 'ann-grid', target: 'grid', text: 'gridDim = 2×2 blocks; blockDim = 32 threads', position: 'below', style: 'callout' },
        { id: 'ann-global', target: 'mem-global', text: 'device DRAM — GBs, slowest', position: 'below', style: 'callout' },
      ],
      animations: [],
    },
    state: {},
    data_sources: { side, level },
  };
})();
