import type {
  Visual, SceneNode, SceneDocument, SceneRelation, View, ViewDef, VisualDoc,
  ResolvedDoc, ResolvedView, RendererContext, RendererFn, FocusState, Layout,
  NodeBase, Custom, NodeType, ScaleDef, Port,
} from './types.js';
import { NODE_DIMENSIONS, SPACE_DIMENSIONS } from './types.js';
import { resolveRefs, evaluateDerived, isVisualDoc } from './state.js';
import { renderLayout } from './layout.js';
import { resolveSpaces, createSpaceContainer, groupNodesBySpace } from './spaceResolver.js';
import { applyBillboard } from './billboardHandler.js';
import { applyPresentationState, clearPresentationState } from './presentationEngine.js';
import { applyEncoding, resolveChannel } from './scale.js';
import { computeDiagramLayout, type LayoutBox } from './diagramLayout.js';
import { resolvePortAnchor, edgePath } from './edgeRouting.js';
import { convertVisualDocToSceneDocument } from './convertVisualDocToSceneDocument.js';

// ── Renderer registry ──────────────────────────────────────────────────────

const registry = new Map<string, RendererFn>();

export function registerRenderer(kind: string, fn: RendererFn): void {
  registry.set(kind, fn);
}

// Built-in Visual (legacy) renderers
import { renderPanel } from './components/panel.js';
import { renderText } from './components/text.js';
import { renderMath } from './components/math.js';
import { renderChart } from './components/chart.js';
import { renderMatrixComp } from './components/matrix.js';
import { renderTableComp } from './components/table.js';
import { renderGraph } from './components/graph.js';
import { renderForm } from './components/form.js';
import { renderButton } from './components/button.js';
import { renderViewRef } from './components/view_ref.js';
import { renderImage } from './components/image.js';
import { renderVector2D, renderCurve2D } from './components/geometry2d.js';
import { renderShape } from './components/shape.js';
import { renderLegend } from './components/legend.js';

registerRenderer('panel', renderPanel as RendererFn);
registerRenderer('text', renderText as RendererFn);
registerRenderer('math', renderMath as RendererFn);
registerRenderer('chart', renderChart as RendererFn);
registerRenderer('matrix', renderMatrixComp as RendererFn);
registerRenderer('table', renderTableComp as RendererFn);
registerRenderer('graph', renderGraph as RendererFn);
registerRenderer('form', renderForm as RendererFn);
registerRenderer('button', renderButton as RendererFn);
registerRenderer('view_ref', renderViewRef as RendererFn);

// SceneNode type renderers — maps NodeType to component
import type { Panel, Text, Math, Chart, Matrix, Table, Graph, Form, Button } from './types.js';

// ── SceneNode renderer registry ─────────────────────────────────────────────

const sceneRendererRegistry = new Map<NodeType, (node: SceneNode, ctx: RendererContext) => HTMLElement>();

function registerSceneRenderer(
  nodeType: NodeType,
  fn: (node: SceneNode, ctx: RendererContext) => HTMLElement,
): void {
  sceneRendererRegistry.set(nodeType, fn);
}

// Map unified NodeType → existing component renderers via adapters.
// Panel renders its children directly as SceneNodes (via renderSceneNode) so
// every child type — including Shape, Image, Vector, Curve — renders correctly.
registerSceneRenderer('Panel', (node, ctx) => {
  const layoutHint = node.layout;
  const strategy = layoutHint?.strategy ?? 'column';
  const el = document.createElement('div');
  el.className = `exd-panel exd-panel-${strategy === 'grid' ? 'grid' : strategy === 'row' ? 'row' : 'column'}`;
  if (strategy === 'grid') {
    const cols = Number((node.geometry as Record<string, unknown>).cols ?? 2);
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.style.display = 'grid';
  }
  const title = String((node.content as Record<string, unknown>).title ?? '');
  if (title) {
    const t = document.createElement('div');
    t.className = 'exd-panel-title';
    t.textContent = title;
    el.appendChild(t);
  }
  for (const child of node.children) {
    el.appendChild(renderSceneNode(child, ctx));
  }
  return el;
});

registerSceneRenderer('Text', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const spec: Text = {
    kind: 'text',
    id: node.id,
    text: String(content.text ?? ''),
    variant: (content.variant as 'heading' | 'body' | 'code' | 'label') ?? 'body',
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderText(spec, ctx);
});

registerSceneRenderer('Code', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const spec: Text = {
    kind: 'text',
    id: node.id,
    text: String(content.source ?? ''),
    variant: 'code',
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderText(spec, ctx);
});

registerSceneRenderer('Equation', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const geometry = node.geometry as Record<string, unknown>;
  const spec: Math = {
    kind: 'math',
    id: node.id,
    source: String(content.source ?? ''),
    display: geometry.display !== false,
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderMath(spec, ctx);
});

registerSceneRenderer('Plot', (node, ctx) => {
  const geometry = node.geometry as Record<string, unknown>;
  const content = node.content as Record<string, unknown>;
  const series = (content.series ?? []) as Record<string, unknown>[];
  const spec: Chart = {
    kind: 'chart',
    id: node.id,
    type: (geometry.chartType as Chart['type']) ?? 'line',
    series: series.map(s => ({
      name: String(s.name ?? ''),
      y: (s.data ?? []) as number[],
      color: String(s.color ?? ''),
    })),
    title: String(content.title ?? ''),
    xLabel: (geometry.xAxis as Record<string, string>)?.label ?? '',
    yLabel: (geometry.yAxis as Record<string, string>)?.label ?? '',
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderChart(spec, ctx);
});

registerSceneRenderer('Matrix', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const geometry = node.geometry as Record<string, unknown>;
  const spec: Matrix = {
    kind: 'matrix',
    id: node.id,
    values: (content.value ?? []) as (number | string)[][],
    rowLabels: geometry.rowLabels as string[] | undefined,
    colLabels: geometry.colLabels as string[] | undefined,
    editable: content.editable as boolean | undefined,
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderMatrixComp(spec, ctx);
});

registerSceneRenderer('Table', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const spec: Table = {
    kind: 'table',
    id: node.id,
    columns: content.columns as string[] | undefined,
    rows: (content.rows ?? []) as (string | number)[][],
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderTableComp(spec, ctx);
});

registerSceneRenderer('Graph', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const graphNodes = (content.nodes ?? []) as Record<string, unknown>[];
  const graphEdges = (content.edges ?? []) as Record<string, unknown>[];
  const spec: Graph = {
    kind: 'graph',
    id: node.id,
    nodes: graphNodes.map(n => ({
      id: String(n.id ?? ''),
      label: String(n.label ?? n.id ?? ''),
    })),
    edges: graphEdges.map(e => ({
      source: String(e.source ?? ''),
      target: String(e.target ?? ''),
      label: e.label ? String(e.label) : undefined,
    })),
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderGraph(spec, ctx);
});

registerSceneRenderer('Form', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const fields = (content.fields ?? []) as Record<string, unknown>[];
  const spec: Form = {
    kind: 'form',
    id: node.id,
    fields: fields.map(f => ({
      name: String(f.id ?? ''),
      label: String(f.label ?? f.id ?? ''),
      type: (f.type as 'number' | 'text' | 'complex' | 'select' | 'boolean' | 'range') ?? 'text',
      value: f.value as string | number | boolean | undefined,
      min: f.min as number | undefined,
      max: f.max as number | undefined,
      step: f.step as number | undefined,
      bind: f.bind as string | undefined,
    })),
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderForm(spec, ctx);
});

registerSceneRenderer('Button', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const spec: Button = {
    kind: 'button',
    id: node.id,
    label: String(content.label ?? 'Button'),
    action: String(content.action ?? ''),
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderButton(spec, ctx);
});

registerSceneRenderer('Image', (node, ctx) => renderImage(node, ctx));

// ── 3D-only node types ──────────────────────────────────────────────────────
// These have no web renderer yet. renderSceneNode intercepts them before
// dispatch (node-level placement check), so these registry entries are only
// reached if the renderer is invoked directly.
function render3DPlaceholder(nodeType: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-placeholder exd-placeholder-3d';
  el.style.cssText = `
    background: #1a1a2e; border: 1px dashed #3a3a6a; border-radius: 6px;
    padding: 20px; text-align: center; color: #606080; font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
  `;
  el.textContent = `[${nodeType}] — 3D (deferred to the 3D renderer)`;
  return el;
}

registerSceneRenderer('Mesh', (node) => render3DPlaceholder('Mesh'));
registerSceneRenderer('Volume', (node) => render3DPlaceholder('Volume'));
registerSceneRenderer('Viewport', (node) => render3DPlaceholder('Viewport'));

// ── 'both'-dimensionality nodes — native 2D form ────────────────────────────
registerSceneRenderer('Vector', (node, ctx) => renderVector2D(node, ctx));
registerSceneRenderer('Curve', (node, ctx) => renderCurve2D(node, ctx));

// Shape: 2D geometric primitive (see components/shape.ts).
registerSceneRenderer('Shape', (node, ctx) => renderShape(node, ctx));

// Legend: visual scale display (see components/legend.ts).
registerSceneRenderer('Legend', (node, ctx) => renderLegend(node, ctx));

// Label: 2D text (billboard text in 3D).
// Content: { text: string, alignment?: string }
// Geometry: { fontSize?: number }
registerSceneRenderer('Label', (node, ctx) => {
  const content = node.content as Record<string, unknown>;
  const spec: Text = {
    kind: 'text',
    id: node.id,
    text: String(content.text ?? ''),
    variant: 'label',
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
  };
  return renderText(spec, ctx);
});
registerSceneRenderer('Group', (node, ctx) => {
  // Group is a pass-through: render children in a wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'exd-group';
  for (const child of node.children) {
    wrapper.appendChild(renderSceneNode(child, ctx));
  }
  return wrapper;
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function convertNodeSemanticToSemantic(
  ns: import('./types.js').NodeSemantic | undefined,
): import('./types.js').Semantic | undefined {
  if (!ns) return undefined;
  return {
    role: ns.role,
    concept: ns.concept_id,
    represents: ns.kind,
    explanation: ns.explanation,
  };
}

function interactionToLegacy(
  interaction: import('./types.js').NodeInteraction | undefined,
): string[] | undefined {
  if (!interaction) return undefined;
  const list: string[] = [];
  if (interaction.hover) list.push('hover');
  if (interaction.select) list.push('select');
  if (interaction.drag) list.push('drag');
  if (interaction.focus) list.push('focus');
  if (interaction.inspect) list.push('inspect');
  if (interaction.edit) list.push('edit');
  return list.length > 0 ? list : undefined;
}

// ── DataBinding helpers ─────────────────────────────────────────────────────

/** Primary content field each node type reads as its bound value. */
const CONTENT_KEY_BY_TYPE: Partial<Record<NodeType, string>> = {
  Text: 'text',
  Label: 'text',
  Code: 'source',
  Equation: 'source',
  Matrix: 'value',
  Plot: 'series',
  Table: 'rows',
};

/**
 * Resolve `node.data.bind` (+ `node.data.path`) against the binding scope and
 * inject the result into the node's primary content field. Expressed as a
 * `$ref` expression so it reuses the existing resolver
 * (bind "A" + path "[0][0]" → "$A[0][0]").
 */
function applyDataBinding(node: SceneNode, scope: Record<string, unknown>): void {
  if (!node.data?.bind) return;
  const expr = '$' + node.data.bind + (node.data.path ?? '');
  const value = resolveRefs(expr, scope, {});
  if (value === expr) return; // unresolvable — keep content as authored
  const key = CONTENT_KEY_BY_TYPE[node.type];
  if (!key) return;
  (node.content as Record<string, unknown>)[key] = value;
}

/** Extract the top-level key a `$ref` expression or binding name refers to. */
function refTopKey(ref: string): string {
  const s = ref.startsWith('$') ? ref.slice(1) : ref;
  const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s);
  return m ? m[0] : s;
}

/**
 * Collect the top-level state keys a single node depends on (from `$ref`
 * strings in its content/geometry and its `data.bind`). Children are NOT
 * walked — the caller maps each node to its own id.
 */
function collectNodeDependencies(node: SceneNode): string[] {
  const keys = new Set<string>();
  const visit = (v: unknown): void => {
    if (typeof v === 'string' && v.startsWith('$') && v.length > 1) {
      keys.add(refTopKey(v));
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v && typeof v === 'object' && v.constructor === Object) {
      for (const val of Object.values(v as Record<string, unknown>)) visit(val);
    }
  };
  visit(node.content);
  visit(node.geometry);
  if (node.data?.bind) keys.add(refTopKey(node.data.bind));
  if (node.encode) {
    for (const ch of [node.encode.size, node.encode.color, node.encode.opacity, node.encode.shape, node.encode.label, node.encode.edge_width]) {
      if (ch) keys.add(refTopKey(ch.source));
    }
  }
  return [...keys];
}

/** Find a node by id within a node tree (depth-first). */
function findSceneNodeById(nodes: SceneNode[], id: string): SceneNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findSceneNodeById(n.children, id);
    if (found) return found;
  }
  return null;
}

/** Parse a CSS dimension string ("600", "600px", "50%") to a number, or fallback. */
function parseDim(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// ── SceneNode render dispatcher ─────────────────────────────────────────────

export function renderSceneNode(node: SceneNode, ctx: RendererContext): HTMLElement {
  // Check visibility
  if (!node.style.visible) {
    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    return hidden;
  }

  // Placement validation: 3D-only node types have no web renderer yet.
  if (NODE_DIMENSIONS[node.type] === '3d') {
    console.warn(
      `[extropian-web-ui] node "${node.id}" (${node.type}) is 3D-only; ` +
      'rendering placeholder until the 3D backend lands.',
    );
    return render3DPlaceholder(node.type);
  }

  const fn = sceneRendererRegistry.get(node.type);
  if (!fn) {
    const el = document.createElement('div');
    el.className = 'exd-error';
    el.textContent = `[unknown node type: ${node.type}]`;
    return el;
  }

  const el = fn(node, ctx);

  // Apply data attributes
  applySceneNodeAttrs(el, node);

  // Apply billboard
  applyBillboard(el, node);

  // Apply style overrides
  applyNodeStyle(el, node);

  // Apply opacity
  if (node.style.opacity < 1) {
    el.style.opacity = String(node.style.opacity);
  }

  return el;
}

function applySceneNodeAttrs(el: HTMLElement, node: SceneNode): void {
  el.setAttribute('data-exd-id', node.id);
  el.setAttribute('data-node-type', node.type);
  el.setAttribute('data-space', node.space);

  if (node.semantic) {
    el.setAttribute('data-semantic-role', node.semantic.role);
    el.setAttribute('data-semantic-concept', node.semantic.concept_id);
    el.title = node.semantic.explanation || node.semantic.concept_id || '';
  }

  // Expose declared ports for relation anchoring (edge routing).
  if (node.ports && node.ports.length > 0) {
    el.setAttribute('data-ports', JSON.stringify(node.ports));
  }

  if (node.interaction.select || node.interaction.focus || node.interaction.inspect) {
    el.style.cursor = 'pointer';
    el.tabIndex = 0;
  }
}

function applyNodeStyle(el: HTMLElement, node: SceneNode): void {
  switch (node.style.emphasis) {
    case 'prominent':
      el.style.boxShadow = '0 0 8px 1px rgba(255, 200, 50, 0.4)';
      break;
    case 'primary':
      el.style.boxShadow = '0 0 4px 0px rgba(74, 158, 255, 0.3)';
      break;
    case 'subtle':
      el.style.opacity = '0.6';
      break;
  }
}

// ── View implementation ────────────────────────────────────────────────────

class ViewImpl implements View {
  root!: HTMLElement;
  private _handlers = new Map<string, Set<(payload: unknown) => void>>();
  private _container: HTMLElement;
  private _visual: Visual | null = null;
  private _doc: VisualDoc | null = null;
  private _sceneDoc: SceneDocument | null = null;
  private _state: Record<string, unknown> = {};
  private _derived: Record<string, unknown> = {};
  private _focus: FocusState = {};
  /** Reactive dependency map: top-level state key → set of node ids that reference it. */
  private _deps = new Map<string, Set<string>>();
  /** Named visual scales from SceneDocument.scales (for encoding resolution). */
  private _scales = new Map<string, ScaleDef>();
  /** Relations from the document, for hover-highlight + edge anchoring. */
  private _relations: SceneRelation[] = [];
  private _hoveredId: string | null = null;
  private _onHover = (e: MouseEvent): void => this._handleHover(e);
  private _onHoverLeave = (): void => this._clearHover();

  constructor(container: HTMLElement, input: Visual | VisualDoc | SceneDocument) {
    this._container = container;
    container.innerHTML = '';

    // Delegated hover-highlight (nodes + their incident edges/neighbors).
    container.addEventListener('mouseover', this._onHover);
    container.addEventListener('mouseleave', this._onHoverLeave);

    if (isSceneDocument(input)) {
      this._sceneDoc = input as SceneDocument;
      this._state = structuredClone((input as SceneDocument).state ?? {});
      this._renderSceneDocument();
    } else if (isVisualDoc(input)) {
      this._doc = input as VisualDoc;
      this._state = structuredClone((input as VisualDoc).state ?? {});
      this._derived = evaluateDerived((input as VisualDoc).derive ?? {}, this._state);
      this._resolveAndRender();
    } else {
      this._visual = input as Visual;
      const ctx = this._makeCtx();
      const el = renderNode(input as Visual, ctx);
      this.root = el;
      container.appendChild(el);
    }
  }

  on(action: string, handler: (payload: unknown) => void): () => void {
    let set = this._handlers.get(action);
    if (!set) { set = new Set(); this._handlers.set(action, set); }
    set.add(handler);
    return () => set?.delete(handler);
  }

  find(id: string): HTMLElement | null {
    return this._container.querySelector(`[data-exd-id="${id}"]`) ?? null;
  }

  update(visual: Visual): void {
    this._visual = visual;
    this._doc = null;
    this._sceneDoc = null;
    this._container.innerHTML = '';
    const ctx = this._makeCtx();
    const el = renderNode(visual, ctx);
    this.root = el;
    this._container.appendChild(el);
  }

  updateDocument(doc: VisualDoc): void {
    this._doc = doc;
    this._sceneDoc = null;
    this._state = structuredClone(doc.state ?? {});
    this._derived = evaluateDerived(doc.derive ?? {}, this._state);
    this._resolveAndRender();
  }

  renderSceneDocument(doc: SceneDocument): void {
    this._sceneDoc = doc;
    this._state = structuredClone(doc.state ?? {});
    this._doc = null;
    this._visual = null;
    this._renderSceneDocument();
  }

  getFocus(): FocusState { return { ...this._focus }; }

  setFocus(f: Partial<FocusState>): void {
    this._focus = { ...this._focus, ...f };
    this._container.querySelectorAll('[data-exd-selected]').forEach(e => e.removeAttribute('data-exd-selected'));
    if (this._focus.entity) {
      const el = this.find(this._focus.entity);
      if (el) {
        el.setAttribute('data-exd-selected', 'true');
        el.style.transition = 'outline 0.3s';
        el.style.outline = '2px solid #4a9eff';
        setTimeout(() => { el.style.outline = ''; }, 1500);
      }
    }
  }

  getState(): Record<string, unknown> {
    return { ...this._state, ...this._derived };
  }

  setState(path: string, value: unknown): void {
    const parts = path.replace(/^state\./, '').split(/[\.\[\]]+/).filter(Boolean);
    let obj: Record<string, unknown> = this._state;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!(p in obj) || typeof obj[p] !== 'object') obj[p] = isNaN(+parts[i + 1]) ? {} : [];
      obj = obj[p] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;

    // SceneDocument path: re-render only the nodes that depend on the
    // changed key (targeted update) instead of the whole document. This keeps
    // continuous inputs (range sliders, text fields) from being torn down
    // mid-interaction.
    if (this._sceneDoc) {
      const key = parts[0];
      if (!key) {
        this._renderSceneDocument();
        return;
      }
      const dependents = this._deps.get(key);
      if (dependents && dependents.size > 0) {
        this._renderDependents(dependents);
      }
      return;
    }

    if (this._doc?.derive) {
      this._derived = evaluateDerived(this._doc.derive, this._state);
    }
    this._resolveAndRender();
  }

  unmount(): void {
    this._container.innerHTML = '';
    this._handlers.clear();
    this._focus = {};
    this._container.removeEventListener('mouseover', this._onHover);
    this._container.removeEventListener('mouseleave', this._onHoverLeave);
  }

  // ── Hover-highlight (interaction) ─────────────────────────────────────────

  private _handleHover(e: MouseEvent): void {
    const target = (e.target as Element).closest?.('[data-exd-id]') as HTMLElement | null;
    const id = target?.getAttribute('data-exd-id') ?? null;
    if (id === this._hoveredId) return;
    this._hoveredId = id;
    this._clearHover();
    if (id) this._applyHover(id);
  }

  private _applyHover(id: string): void {
    this._setHover(id, true);
    for (const rel of this._relations) {
      if (rel.source === id || rel.target === id) {
        this._setHover(rel.source, true);
        this._setHover(rel.target, true);
        this._container.querySelectorAll(`[data-rel-id="${rel.id}"]`)
          .forEach(p => p.setAttribute('data-exd-hovered', 'true'));
      }
    }
  }

  private _setHover(id: string, on: boolean): void {
    const el = this.find(id);
    if (el) {
      if (on) el.setAttribute('data-exd-hovered', 'true');
      else el.removeAttribute('data-exd-hovered');
    }
  }

  private _clearHover(): void {
    this._container.querySelectorAll('[data-exd-hovered]')
      .forEach(el => el.removeAttribute('data-exd-hovered'));
  }

  // ── Internal: SceneDocument rendering ────────────────────────────────────

  /** Merged data scope: state (canonical) with data_sources shadowing it. */
  private _bindingScope(): Record<string, unknown> {
    return { ...this._state, ...(this._sceneDoc?.data_sources ?? {}) };
  }

  /**
   * Return the document's nodes with all `$ref` strings resolved against the
   * current state. The original document is left untouched (deep-cloned first)
   * so repeated re-renders re-resolve from scratch.
   */
  private _resolvedSceneNodes(): SceneNode[] {
    if (!this._sceneDoc) return [];
    const nodes = structuredClone(this._sceneDoc.nodes) as SceneNode[];

    const bindingScope = this._bindingScope();

    const visit = (n: SceneNode): void => {
      applyDataBinding(n, bindingScope);
      applyEncoding(n, this._scales, bindingScope);
      n.children.forEach(visit);
    };
    nodes.forEach(visit);

    // Resolve $ref strings in content/geometry against state.
    return resolveRefs(nodes, this._state, {}) as unknown as SceneNode[];
  }

  /**
   * Resolve a single node (for a targeted re-render): clone it, apply its
   * data binding, then resolve $refs against the current state.
   */
  private _resolveSingleNode(node: SceneNode): SceneNode {
    const clone = structuredClone(node) as SceneNode;
    const bindingScope = this._bindingScope();
    applyDataBinding(clone, bindingScope);
    applyEncoding(clone, this._scales, bindingScope);
    return resolveRefs(clone, this._state, {}) as unknown as SceneNode;
  }

  /** Re-render only the given dependent nodes, replacing them in place. */
  private _renderDependents(ids: Set<string>): void {
    const ctx = this._makeCtx();
    const nodes = this._sceneDoc?.nodes ?? [];
    for (const id of ids) {
      const el = this.find(id);
      if (!el) continue;
      const node = findSceneNodeById(nodes, id);
      if (!node) continue;
      el.replaceWith(renderSceneNode(this._resolveSingleNode(node), ctx));
    }
  }

  /** Rebuild the state-key → node-id dependency map from the document tree. */
  private _rebuildDependencies(): void {
    const deps = new Map<string, Set<string>>();
    const walk = (n: SceneNode): void => {
      for (const key of collectNodeDependencies(n)) {
        let set = deps.get(key);
        if (!set) { set = new Set(); deps.set(key, set); }
        set.add(n.id);
      }
      n.children.forEach(walk);
    };
    (this._sceneDoc?.nodes ?? []).forEach(walk);
    this._deps = deps;
  }

  /** Rebuild the named visual scale registry from SceneDocument.scales. */
  private _rebuildScales(): void {
    this._scales = new Map((this._sceneDoc?.scales ?? []).map(s => [s.id, s]));
  }

  private _renderSceneDocument(): void {
    if (!this._sceneDoc) return;
    const doc = this._sceneDoc;
    this._relations = doc.relations ?? [];
    this._container.innerHTML = '';
    clearPresentationState(this._container);

    // Recompute the reactive dependency map (used by targeted setState updates).
    this._rebuildDependencies();
    this._rebuildScales();

    // Resolve spaces
    const spaces = resolveSpaces(doc.spaces);
    const screenSpace = [...spaces.values()].find(s => s.type === 'screen');

    // Find or create screen space
    const screenId = screenSpace?.id ?? 'screen';

    // Group nodes by space (children render inline inside their parent)
    const nodesBySpace = groupNodesBySpace(this._resolvedSceneNodes());

    const ctx = this._makeCtx();

    // Create screen container
    const screenEl = screenSpace
      ? createSpaceContainer(screenSpace, spaces)
      : (() => {
          const el = document.createElement('div');
          el.className = 'exd-screen';
          el.style.cssText = 'position:relative;width:100%;min-height:100%;background:#0e0e1a;';
          return el;
        })();

    // Render root nodes in screen space
    const screenNodes = nodesBySpace.get(screenId) ?? [];
    for (const node of screenNodes) {
      screenEl.appendChild(renderSceneNode(node, ctx));
    }

    // Render non-screen spaces as nested containers
    for (const [spaceId, nodes] of nodesBySpace) {
      if (spaceId === screenId) continue;
      const space = spaces.get(spaceId);
      if (!space) continue;
      const spaceEl = createSpaceContainer(space, spaces);

      // Placement validation: 3D spaces render as placeholders until the
      // 3D backend lands (their nodes are not individually rendered).
      if (SPACE_DIMENSIONS[space.type] === '3d') {
        console.warn(
          `[extropian-web-ui] space "${spaceId}" (${space.type}) is 3D; ` +
          'rendering placeholder until the 3D backend lands.',
        );
        spaceEl.appendChild(render3DPlaceholder(space.type));
        screenEl.appendChild(spaceEl);
        continue;
      }

      // Apply container arrangement (grid/treemap/layered/…), or fall back to
      // flow layout when no arrangement is specified.
      if (space.arrangement) {
        const arrangement = space.arrangement;
        const area = {
          width: parseDim(space.cssWidth, 800),
          height: parseDim(space.cssHeight, 600),
        };
        const boxes = computeDiagramLayout(arrangement, nodes, this._bindingScope(), this._scales, area, doc.relations);
        const colorBy = arrangement.color_by;

        spaceEl.style.position = 'relative';
        spaceEl.style.width = `${area.width}px`;
        spaceEl.style.height = `${area.height}px`;
        spaceEl.style.overflow = 'visible';

        const applyColor = (n: SceneNode): void => {
          if (colorBy) {
            const color = resolveChannel(colorBy, this._bindingScope(), this._scales, n.id);
            if (typeof color === 'string') (n.geometry as Record<string, unknown>).fill = color;
          }
        };
        const place = (el: HTMLElement, box: LayoutBox | undefined): void => {
          if (!box) return;
          el.style.position = 'absolute';
          el.style.left = `${box.x}px`;
          el.style.top = `${box.y}px`;
          el.style.width = `${box.width}px`;
          el.style.height = `${box.height}px`;
          el.style.boxSizing = 'border-box';
        };

        if (arrangement.algorithm === 'tree' || arrangement.algorithm === 'radial') {
          // Hierarchy layouts position the whole subtree — flatten-render it
          // (each node shallowly, children placed by the layout, not inline).
          const renderFlat = (n: SceneNode): void => {
            applyColor(n);
            const el = renderSceneNode({ ...n, children: [] }, ctx);
            place(el, boxes.get(n.id));
            spaceEl.appendChild(el);
            for (const child of n.children) renderFlat(child);
          };
          for (const node of nodes) renderFlat(node);
        } else {
          for (const node of nodes) {
            applyColor(node);
            const el = renderSceneNode(node, ctx);
            place(el, boxes.get(node.id));
            spaceEl.appendChild(el);
          }
        }
      } else {
        for (const node of nodes) {
          spaceEl.appendChild(renderSceneNode(node, ctx));
        }
      }
      screenEl.appendChild(spaceEl);
    }

    this.root = screenEl;
    this._container.appendChild(screenEl);

    // Render relations (edges between nodes)
    if (doc.relations && doc.relations.length > 0) {
      renderSceneRelations(doc.relations, this._container);
    }

    // Apply presentation state
    if (doc.presentation) {
      applyPresentationState(this._container, doc.presentation);
    }
  }

  // ── Internal: Legacy VisualDoc rendering ─────────────────────────────────

  private _resolveAndRender(): void {
    if (!this._doc) return;
    const doc = this._doc;
    this._container.innerHTML = '';

    const viewMap = new Map<string, ResolvedView>();
    const views = doc.views ?? [];
    for (const v of views) {
      const resolved = resolveRefs(
        structuredClone(v),
        this._state,
        this._derived,
      ) as unknown as ViewDef;
      viewMap.set(resolved.id, {
        id: resolved.id,
        type: resolved.type,
        title: resolved.title,
        objects: resolved.objects ?? (resolved.content ? [resolved.content] : []),
        semantic: resolved.semantic,
        interaction: resolved.interaction,
      });
    }

    const ctx = this._makeCtx();

    if (doc.layout) {
      const resolved = resolveRefs(
        structuredClone(doc.layout),
        this._state,
        this._derived,
      ) as unknown as Layout;
      this.root = renderLayout(resolved, viewMap, ctx);
    } else if (doc.root) {
      const resolved = resolveRefs(
        structuredClone(doc.root),
        this._state,
        this._derived,
      ) as unknown as Visual;
      this.root = renderNode(resolved, ctx);
    } else {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '12px';
      for (const [, rv] of viewMap) {
        const el = document.createElement('div');
        el.setAttribute('data-exd-id', rv.id);
        if (rv.title) {
          const t = document.createElement('div');
          t.className = 'exd-panel-title';
          t.textContent = rv.title;
          el.appendChild(t);
        }
        for (const obj of rv.objects) {
          el.appendChild(ctx.render(obj));
        }
        wrapper.appendChild(el);
      }
      this.root = wrapper;
    }

    this._container.appendChild(this.root);

    if (doc.presentation) {
      this._applyPresentation(doc.presentation);
    }
  }

  private _applyPresentation(ps: import('./types.js').PresentationState): void {
    if (ps.highlights) {
      for (const id of ps.highlights) {
        const el = this.find(id);
        if (el) {
          el.style.boxShadow = '0 0 8px #4a9eff';
          el.style.outline = '1px solid #4a9eff';
        }
      }
    }
    if (ps.isolation) {
      const iso = new Set(ps.isolation);
      this._container.querySelectorAll('[data-exd-id]').forEach(el => {
        const e = el as HTMLElement;
        if (!iso.has(e.getAttribute('data-exd-id') ?? '')) {
          e.style.opacity = '0.15';
          e.style.transition = 'opacity 0.3s';
        }
      });
    }
    if (ps.annotations) {
      for (const ann of ps.annotations) {
        const target = this.find(ann.target);
        if (target) {
          const label = document.createElement('div');
          label.className = 'exd-annotation';
          label.textContent = ann.content;
          label.style.cssText = `
            position: absolute; background: #1a1a4e; border: 1px solid #4a9eff;
            color: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 11px;
            white-space: nowrap; z-index: 20; pointer-events: none;
          `;
          const pos = ann.position ?? 'top';
          const rect = target.getBoundingClientRect();
          const parentRect = this._container.getBoundingClientRect();
          if (pos === 'top' || pos === 'bottom') {
            label.style.left = `${rect.left - parentRect.left + rect.width / 2}px`;
            label.style.transform = 'translateX(-50%)';
            label.style.top = pos === 'top'
              ? `${rect.top - parentRect.top - 24}px`
              : `${rect.bottom - parentRect.top + 4}px`;
          } else {
            label.style.top = `${rect.top - parentRect.top + rect.height / 2}px`;
            label.style.transform = 'translateY(-50%)';
            label.style.left = pos === 'left'
              ? `${rect.left - parentRect.left - 8}px`
              : `${rect.right - parentRect.left + 4}px`;
          }
          this._container.style.position = 'relative';
          this._container.appendChild(label);
        }
      }
    }
  }

  private _makeCtx(): RendererContext {
    const self = this;
    return {
      render(v: Visual) { return renderNode(v, self._makeCtx()); },
      renderNode(node: SceneNode) { return renderSceneNode(node, self._makeCtx()); },
      emit(action: string, payload: unknown) {
        const set = self._handlers.get(action);
        if (set) for (const fn of set) fn(payload);
        const wild = self._handlers.get('*');
        if (wild && wild !== set) for (const fn of wild) fn({ action, payload });
      },
      focus(entityId: string, isSelection?: boolean) {
        self._focus.entity = entityId;
        if (isSelection) {
          self._focus.selection = [entityId];
        }
        self._focus.path = self._focus.path ?? [];
      },
      getFocus: () => ({ ...self._focus }),
      getState: () => ({ ...self._state, ...self._derived }),
      setState(path: string, value: unknown) { self.setState(path, value); },
      getScales: () => self._scales,
    };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function render(input: Visual | VisualDoc | SceneDocument, container: HTMLElement): View {
  return new ViewImpl(container, input);
}

/**
 * Standalone function to render a SceneDocument directly.
 * Creates a View that manages lifecycle (unmount, focus, state).
 */
export function renderSceneDocument(doc: SceneDocument, container: HTMLElement): View {
  return new ViewImpl(container, doc);
}

// ── SceneRelation rendering ─────────────────────────────────────────────────

/**
 * Render SceneRelations as SVG edges between source and target DOM nodes.
 * Uses absolute-positioned SVG overlay inside the container.
 */
export function renderSceneRelations(
  relations: import('./types.js').SceneRelation[],
  container: HTMLElement,
): void {
  if (relations.length === 0) return;

  // Create SVG overlay
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'exd-relations-overlay');
  svg.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 5; overflow: visible;
  `;
  container.style.position = 'relative';
  container.appendChild(svg);

  // Create marker definitions
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <marker id="exd-arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#4a9eff" />
    </marker>
    <marker id="exd-arrowhead-dashed" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#8080b0" />
    </marker>
  `;
  svg.appendChild(defs);

  for (const rel of relations) {
    const sourceEl = container.querySelector(`[data-exd-id="${rel.source}"]`) as HTMLElement | null;
    const targetEl = container.querySelector(`[data-exd-id="${rel.target}"]`) as HTMLElement | null;
    if (!sourceEl || !targetEl) continue;

    const containerRect = container.getBoundingClientRect();
    const sAnchor = resolvePortAnchor(sourceEl.getBoundingClientRect(), rel.source_port, parsePorts(sourceEl.getAttribute('data-ports')));
    const tAnchor = resolvePortAnchor(targetEl.getBoundingClientRect(), rel.target_port, parsePorts(targetEl.getAttribute('data-ports')));

    const x1 = sAnchor.x - containerRect.left;
    const y1 = sAnchor.y - containerRect.top;
    const x2 = tAnchor.x - containerRect.left;
    const y2 = tAnchor.y - containerRect.top;

    const type = rel.style.type ?? 'arrow';
    const color = rel.style.color ?? '#4a9eff';
    const bundle = rel.bundle ?? 1;
    const width = (rel.style.width ?? 2) * (bundle > 1 ? Math.min(1 + Math.log2(bundle), 3) : 1);
    const dash = rel.style.dash ? '8,4' : 'none';
    const isArrow = type === 'arrow' || type === 'line';
    const markerEnd = isArrow ? (dash === 'none' ? 'url(#exd-arrowhead)' : 'url(#exd-arrowhead-dashed)') : 'none';

    if (Math.hypot(x2 - x1, y2 - y1) < 1) continue;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', edgePath(x1, y1, x2, y2, type));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(type === 'tube' ? width * 2 : width));
    path.setAttribute('stroke-dasharray', dash);
    if (type === 'tube') path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('marker-end', markerEnd);
    path.setAttribute('data-rel-id', rel.id);
    path.setAttribute('data-rel-source', rel.source);
    path.setAttribute('data-rel-target', rel.target);
    svg.appendChild(path);

    // Label at midpoint (bundled edges show "×N")
    const labelText = bundle > 1
      ? (rel.label?.text ? `${rel.label.text} ×${bundle}` : `×${bundle}`)
      : rel.label?.text;
    if (labelText) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(mx));
      text.setAttribute('y', String(my - 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#8080b0');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.textContent = labelText;
      svg.appendChild(text);
    }
  }
}

/** Parse the `data-ports` attribute (JSON) back into a Port list. */
function parsePorts(attr: string | null): Port[] {
  if (!attr) return [];
  try {
    const v = JSON.parse(attr);
    return Array.isArray(v) ? (v as Port[]) : [];
  } catch {
    return [];
  }
}

// ── Type guard ──────────────────────────────────────────────────────────────

export function isSceneDocument(input: unknown): input is SceneDocument {
  if (!input || typeof input !== 'object') return false;
  const d = input as Record<string, unknown>;
  return ('spaces' in d && 'nodes' in d && 'state' in d && 'data_sources' in d);
}

/**
 * True when the document is entirely 2D: every space is 2D (orthographic,
 * no camera) and no node is 3D-only. Consumers use this to assert the
 * "fixed 2D, no camera" web path. See docs/CONTRACT.md §18.
 */
export function is2DSceneDocument(doc: SceneDocument): boolean {
  if (doc.spaces.some(s => SPACE_DIMENSIONS[s.type] === '3d' || s.projection === 'perspective')) {
    return false;
  }
  const has3DNode = (nodes: SceneNode[]): boolean =>
    nodes.some(n => NODE_DIMENSIONS[n.type] === '3d' || has3DNode(n.children));
  return !has3DNode(doc.nodes);
}

// ── Internal render dispatcher (legacy Visual) ──────────────────────────────

function renderNode(v: Visual, ctx: RendererContext): HTMLElement {
  const kind = v.kind;

  if (kind === 'custom') {
    const c = v as unknown as Custom;
    const fn = registry.get(c.type ?? '');
    if (!fn) {
      const el = document.createElement('div');
      el.textContent = `[unknown renderer: ${c.type}]`;
      return el;
    }
    const el = fn(c.props ?? {}, ctx);
    applyNodeAttrs(el, v);
    return el;
  }

  const fn = registry.get(kind);
  if (!fn) {
    const el = document.createElement('div');
    el.className = 'exd-error';
    el.textContent = `[unknown kind: ${kind}]`;
    return el;
  }

  const el = fn(v, ctx);
  applyNodeAttrs(el, v);
  return el;
}

export function applyNodeAttrs(el: HTMLElement, v: NodeBase): void {
  if (v.id) el.setAttribute('data-exd-id', v.id);
  if (v.action) el.setAttribute('data-exd-action', v.action);
  if (v.semantic) {
    el.setAttribute('data-semantic-role', v.semantic.role ?? '');
    el.title = v.semantic.explanation ?? v.semantic.concept ?? v.semantic.represents ?? '';
  }
  if (v.interaction) {
    el.setAttribute('data-interaction', v.interaction.join(','));
    if (v.interaction.includes('select') || v.interaction.includes('focus')) {
      el.style.cursor = 'pointer';
      el.tabIndex = 0;
    }
  }
  if (v.style) {
    for (const [key, val] of Object.entries(v.style)) {
      (el.style as any)[key] = String(val);
    }
  }
}

// Re-export types
export type { View, RendererContext, RendererFn } from './types.js';
export type { Visual, VisualDoc, Layout, Control, Semantic, FocusState } from './types.js';
