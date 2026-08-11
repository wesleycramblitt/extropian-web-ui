import type {
  Visual, SceneNode, SceneDocument, View, ViewDef, VisualDoc,
  ResolvedDoc, ResolvedView, RendererContext, RendererFn, FocusState, Layout,
  NodeBase, Custom, NodeType,
} from './types.js';
import { resolveRefs, evaluateDerived, isVisualDoc } from './state.js';
import { renderLayout } from './layout.js';
import { resolveSpaces, createSpaceContainer, groupNodesBySpace } from './spaceResolver.js';
import { applyBillboard } from './billboardHandler.js';
import { applyPresentationState, clearPresentationState } from './presentationEngine.js';
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

// Map unified NodeType → existing component renderers via adapters
registerSceneRenderer('Panel', (node, ctx) => {
  const layoutHint = node.layout;
  const strategy = layoutHint?.strategy ?? 'column';
  const panelSpec: Panel = {
    kind: 'panel',
    id: node.id,
    layout: (strategy === 'grid') ? 'grid' : (strategy as 'row' | 'column'),
    cols: strategy === 'grid' ? 2 : undefined,
    title: String(node.content.title ?? ''),
    children: node.children.map(c => convertSceneNodeToVisual(c)),
    semantic: convertNodeSemanticToSemantic(node.semantic),
    interaction: interactionToLegacy(node.interaction),
    style: node.style && node.style.visible ? {} : { opacity: node.style.opacity },
  };
  return renderPanel(panelSpec, ctx);
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

// Placeholder renderers for 3D types (v0.2)
function renderPlaceholder(nodeType: string): (node: SceneNode) => HTMLElement {
  return (node: SceneNode) => {
    const el = document.createElement('div');
    el.className = 'exd-placeholder';
    el.style.cssText = `
      background: #1a1a2e; border: 1px dashed #3a3a6a; border-radius: 6px;
      padding: 20px; text-align: center; color: #606080; font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    `;
    el.textContent = `[${nodeType}] — 3D not yet available (v0.2)`;
    return el;
  };
}

registerSceneRenderer('Vector', (node, ctx) => renderPlaceholder('Vector')(node));
registerSceneRenderer('Curve', (node, ctx) => renderPlaceholder('Curve')(node));
registerSceneRenderer('Mesh', (node, ctx) => renderPlaceholder('Mesh')(node));
registerSceneRenderer('Volume', (node, ctx) => renderPlaceholder('Volume')(node));
// Label: 2D billboard text — renders same as Text node.
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
registerSceneRenderer('Viewport', (node, ctx) => renderPlaceholder('Viewport')(node));
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

function convertSceneNodeToVisual(node: SceneNode): Visual {
  const content = node.content as Record<string, unknown>;
  switch (node.type) {
    case 'Panel': return { kind: 'panel', title: String(content.title ?? ''), children: node.children.map(c => convertSceneNodeToVisual(c)) };
    case 'Text': return { kind: 'text', text: String(content.text ?? ''), variant: (content.variant as any) ?? 'body' };
    case 'Code': return { kind: 'text', text: String(content.source ?? ''), variant: 'code' };
    case 'Equation': return { kind: 'math', source: String(content.source ?? '') };
    case 'Plot': return { kind: 'chart', type: 'line', series: [] };
    case 'Matrix': return { kind: 'matrix', values: (content.value ?? [[]]) as (number | string)[][] };
    case 'Table': return { kind: 'table', rows: (content.rows ?? []) as (string | number)[][] };
    case 'Graph': return { kind: 'graph', nodes: [], edges: [] };
    case 'Form': return { kind: 'form', fields: [] };
    case 'Button': return { kind: 'button', label: String(content.label ?? '') };
    case 'Image': return { kind: 'text', text: '[Image]', variant: 'label' };
    default: return { kind: 'text', text: `[${node.type}]`, variant: 'label' };
  }
}

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

// ── SceneNode render dispatcher ─────────────────────────────────────────────

export function renderSceneNode(node: SceneNode, ctx: RendererContext): HTMLElement {
  // Check visibility
  if (!node.style.visible) {
    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    return hidden;
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

  constructor(container: HTMLElement, input: Visual | VisualDoc | SceneDocument) {
    this._container = container;
    container.innerHTML = '';

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
    if (this._doc?.derive) {
      this._derived = evaluateDerived(this._doc.derive, this._state);
    }
    this._resolveAndRender();
  }

  unmount(): void {
    this._container.innerHTML = '';
    this._handlers.clear();
    this._focus = {};
  }

  // ── Internal: SceneDocument rendering ────────────────────────────────────

  private _renderSceneDocument(): void {
    if (!this._sceneDoc) return;
    const doc = this._sceneDoc;
    this._container.innerHTML = '';
    clearPresentationState(this._container);

    // Resolve spaces
    const spaces = resolveSpaces(doc.spaces);
    const screenSpace = [...spaces.values()].find(s => s.type === 'screen');

    // Find or create screen space
    const screenId = screenSpace?.id ?? 'screen';

    // Group nodes by space
    const nodesBySpace = groupNodesBySpace(doc.nodes);

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
      for (const node of nodes) {
        spaceEl.appendChild(renderSceneNode(node, ctx));
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
    const sRect = sourceEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    const x1 = sRect.left + sRect.width / 2 - containerRect.left;
    const y1 = sRect.top + sRect.height / 2 - containerRect.top;
    const x2 = tRect.left + tRect.width / 2 - containerRect.left;
    const y2 = tRect.top + tRect.height / 2 - containerRect.top;

    const color = rel.style.color ?? '#4a9eff';
    const width = rel.style.width ?? 2;
    const dash = rel.style.dash ? '8,4' : 'none';
    const markerEnd = rel.style.type === 'arrow' || rel.style.type === 'line'
      ? (dash === 'none' ? 'url(#exd-arrowhead)' : 'url(#exd-arrowhead-dashed)')
      : 'none';

    // Offset endpoints slightly inward to leave room for arrowhead
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;

    const inset = 8;
    const ex1 = x1 + (dx / len) * inset;
    const ey1 = y1 + (dy / len) * inset;
    const ex2 = x2 - (dx / len) * inset;
    const ey2 = y2 - (dy / len) * inset;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(ex1));
    line.setAttribute('y1', String(ey1));
    line.setAttribute('x2', String(ex2));
    line.setAttribute('y2', String(ey2));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', String(width));
    line.setAttribute('stroke-dasharray', dash);
    line.setAttribute('marker-end', markerEnd);
    line.setAttribute('data-rel-id', rel.id);
    line.setAttribute('data-rel-source', rel.source);
    line.setAttribute('data-rel-target', rel.target);

    svg.appendChild(line);

    // Label at midpoint
    if (rel.label?.text) {
      const mx = (ex1 + ex2) / 2;
      const my = (ey1 + ey2) / 2;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(mx));
      text.setAttribute('y', String(my - 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#8080b0');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.textContent = rel.label.text;
      svg.appendChild(text);
    }
  }
}

// ── Type guard ──────────────────────────────────────────────────────────────

export function isSceneDocument(input: unknown): input is SceneDocument {
  if (!input || typeof input !== 'object') return false;
  const d = input as Record<string, unknown>;
  return ('spaces' in d && 'nodes' in d && 'state' in d && 'data_sources' in d);
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
