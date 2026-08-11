// Converts legacy VisualDoc (state/derive/layout/views) into
// unified SceneDocument format for backward compat with old presets.
import type {
  VisualDoc, Visual, ViewDef, Layout,
  Panel, Text as VisualText, Math, Chart, Matrix as VisualMatrix,
  Table as VisualTable, Graph as VisualGraph, Form, Button, ViewRef, Custom,
  Space, SceneNode, SceneRelation, ScenePresentationState,
  SceneAnnotation, NodeSemantic, SceneRelationStyle,
} from './types.js';

export function convertVisualDocToSceneDocument(
  doc: VisualDoc,
  spaces?: Space[],
): {
  nodes: SceneNode[];
  relations: SceneRelation[];
  presentation?: ScenePresentationState;
  spaces: Space[];
  version: number;
  topic: string;
  state: Record<string, unknown>;
  data_sources: Record<string, unknown>;
} {
  const nodes: SceneNode[] = [];
  const relations: SceneRelation[] = [];
  const allSpaces: Space[] = [...(spaces ?? [])];

  if (!allSpaces.find(s => s.type === 'screen')) {
    allSpaces.push({
      id: 'screen', type: 'screen', projection: 'orthographic',
      background: '#0e0e1a', scroll: false,
    });
  }
  const screenId = allSpaces.find(s => s.type === 'screen')?.id ?? 'screen';

  // Convert views to panel SceneNodes
  for (const view of doc.views ?? []) {
    nodes.push(convertViewDef(view, screenId));
  }

  // Flat root -> panel node
  if (doc.root) {
    const rootChildren = convertVisualToSceneNodes(doc.root, screenId);
    nodes.push({
      id: 'root', type: 'Panel', space: screenId,
      geometry: { width: '100%', height: 'auto' },
      content: { title: doc.topic ?? '' },
      interaction: defaultInteraction(),
      style: defaultStyle(),
      children: rootChildren,
    });
  }

  // Convert old relations
  if (doc.relations) {
    for (const rel of doc.relations) {
      relations.push({
        id: `${rel.from}-${rel.to}`,
        source: rel.from, target: rel.to,
        style: defaultRelationStyle(),
        label: rel.label ? { text: rel.label, position: 'middle' } : undefined,
        semantic: { kind: rel.type },
      });
    }
  }

  // Convert presentation
  let presentation: ScenePresentationState | undefined;
  if (doc.presentation) {
    presentation = convertPresentation(doc.presentation);
  }

  return {
    nodes, relations, presentation,
    spaces: allSpaces,
    version: doc.version ?? 1,
    topic: doc.topic ?? '',
    state: doc.state ?? {},
    data_sources: {},
  };
}

// ── Converters ──────────────────────────────────────────────────────────────

function convertViewDef(view: ViewDef, spaceId: string): SceneNode {
  const objects = view.objects ?? (view.content ? [view.content] : []);
  const children = objects.map(o => convertVisualToSceneNodes(o, spaceId)).flat();
  return {
    id: view.id,
    type: 'Panel',
    space: spaceId,
    geometry: { width: '100%', height: 'auto', scroll: true },
    content: { title: view.title ?? '' },
    semantic: convertSemantic(view.semantic),
    interaction: defaultInteraction(),
    style: defaultStyle(),
    children,
  };
}

function convertVisualToSceneNodes(v: Visual, spaceId: string): SceneNode[] {
  switch (v.kind) {
    case 'panel':
      return [convertPanel(v as Panel, spaceId)];
    case 'text':
      return [convertText(v as VisualText, spaceId)];
    case 'math':
      return [convertMath(v as Math, spaceId)];
    case 'chart':
      return [convertChart(v as Chart, spaceId)];
    case 'matrix':
      return [convertMatrix(v as VisualMatrix, spaceId)];
    case 'table':
      return [convertTable(v as VisualTable, spaceId)];
    case 'graph':
      return [convertGraph(v as VisualGraph, spaceId)];
    case 'form':
      return [convertForm(v as Form, spaceId)];
    case 'button':
      return [convertButton(v as Button, spaceId)];
    case 'view_ref':
      return [convertViewRef(v as ViewRef, spaceId)];
    case 'custom':
      return [convertCustom(v as Custom, spaceId)];
  }
}

function defaultInteraction() {
  return { hover: true, select: true, drag: false, focus: true, inspect: true, edit: false };
}

function defaultStyle() {
  return { emphasis: 'default' as const, opacity: 1, depth: 0, visible: true };
}

function defaultRelationStyle(): SceneRelationStyle {
  return { type: 'arrow', color: '#4a4a7a', width: 1.5, dash: false };
}

function baseSemantic(v: { id?: string; semantic?: { role?: string; concept?: string; represents?: string; explanation?: string; related?: string[]; source?: string; category?: string } }): NodeSemantic | undefined {
  if (!v.semantic) return undefined;
  const s = v.semantic;
  const tags: string[] = [];
  if (s.role) tags.push(s.role);
  if (s.category) tags.push(s.category);
  return {
    role: s.role ?? '',
    concept: s.concept ?? s.represents ?? '',
    kind: s.role ?? '',
    explanation: s.explanation ?? '',
    tags,
  };
}

function convertSemantic(s: { role?: string; concept?: string; represents?: string; explanation?: string; related?: string[]; source?: string; category?: string } | undefined): NodeSemantic | undefined {
  if (!s) return undefined;
  const tags: string[] = [];
  if (s.role) tags.push(s.role);
  if (s.category) tags.push(s.category);
  return {
    role: s.role ?? '',
    concept: s.concept ?? s.represents ?? '',
    kind: s.role ?? '',
    explanation: s.explanation ?? '',
    tags,
  };
}

function convertPanel(p: Panel, spaceId: string): SceneNode {
  const layout = p.layout ?? 'column';
  const colsNum = p.cols ?? 1;
  return {
    id: p.id ?? `panel-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Panel', space: spaceId,
    geometry: { width: '100%', height: 'auto', scroll: false },
    layout: layout === 'grid'
      ? { strategy: 'grid', gap: 12, padding: 16, alignment: 'start', min_width: 0, max_width: undefined }
      : { strategy: layout as 'row' | 'column', gap: 12, padding: 16, alignment: 'start' },
    content: { title: p.title ?? '' },
    semantic: baseSemantic(p),
    interaction: interactionFromList(p.interaction),
    style: styleFromBase(p),
    children: (p.children ?? []).map(c => convertVisualToSceneNodes(c, spaceId)).flat(),
  };
}

function convertText(t: VisualText, spaceId: string): SceneNode {
  return {
    id: t.id ?? `text-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Text', space: spaceId,
    geometry: {},
    content: { text: t.text, variant: t.variant ?? 'body' },
    semantic: baseSemantic(t),
    interaction: interactionFromList(t.interaction),
    style: styleFromBase(t),
    children: [],
  };
}

function convertMath(m: Math, spaceId: string): SceneNode {
  return {
    id: m.id ?? `eqn-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Equation', space: spaceId,
    geometry: { display: m.display ?? true },
    content: { source: m.source },
    semantic: baseSemantic(m),
    interaction: interactionFromList(m.interaction),
    style: styleFromBase(m),
    children: [],
  };
}

function convertChart(c: Chart, spaceId: string): SceneNode {
  const series = (c.series ?? []).map(s => ({ name: s.name ?? '', data: s.y, color: s.color, lineWidth: 2 }));
  return {
    id: c.id ?? `chart-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Plot', space: spaceId,
    geometry: {
      chartType: c.type, width: 600, height: 300,
      xAxis: { label: c.xLabel ?? '' },
      yAxis: { label: c.yLabel ?? '' },
      grid: true, legend: series.some(s => s.name !== ''),
    },
    content: { series, title: c.title ?? '' },
    semantic: baseSemantic(c),
    interaction: interactionFromList(c.interaction),
    style: styleFromBase(c),
    children: [],
  };
}

function convertMatrix(mx: VisualMatrix, spaceId: string): SceneNode {
  return {
    id: mx.id ?? `matrix-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Matrix', space: spaceId,
    geometry: {
      rows: mx.values.length, cols: mx.values[0]?.length ?? 0,
      showRowLabels: !!(mx.rowLabels?.length),
      showColLabels: !!(mx.colLabels?.length),
      rowLabels: mx.rowLabels ?? [],
      colLabels: mx.colLabels ?? [],
    },
    content: { value: mx.values, editable: mx.editable ?? false },
    semantic: baseSemantic(mx),
    interaction: interactionFromList(mx.interaction),
    style: styleFromBase(mx),
    children: [],
  };
}

function convertTable(tb: VisualTable, spaceId: string): SceneNode {
  return {
    id: tb.id ?? `table-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Table', space: spaceId,
    geometry: { sortable: false, filterable: false, striped: true },
    content: { columns: tb.columns ?? [], rows: tb.rows ?? [] },
    semantic: baseSemantic(tb),
    interaction: interactionFromList(tb.interaction),
    style: styleFromBase(tb),
    children: [],
  };
}

function convertGraph(g: VisualGraph, spaceId: string): SceneNode {
  return {
    id: g.id ?? `graph-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Graph', space: spaceId,
    geometry: { layout: 'force-directed', nodeRadius: 16, edgeStyle: 'arrow' },
    content: {
      nodes: g.nodes.map(n => ({ id: n.id, label: n.label ?? n.id })),
      edges: g.edges.map(e => ({ source: e.source, target: e.target, label: e.label })),
    },
    semantic: baseSemantic(g),
    interaction: interactionFromList(g.interaction),
    style: styleFromBase(g),
    children: [],
  };
}

function convertForm(f: Form, spaceId: string): SceneNode {
  return {
    id: f.id ?? `form-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Form', space: spaceId,
    geometry: { layout: 'column', gap: 10 },
    content: { fields: (f.fields ?? []).map(fld => ({
      id: fld.name, label: fld.label ?? fld.name, type: fld.type,
      value: fld.value, min: fld.min, max: fld.max, step: fld.step,
    })) },
    semantic: baseSemantic(f),
    interaction: interactionFromList(f.interaction),
    style: styleFromBase(f),
    children: [],
  };
}

function convertButton(b: Button, spaceId: string): SceneNode {
  return {
    id: b.id ?? `btn-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Button', space: spaceId,
    geometry: { variant: 'primary', size: 'medium' },
    content: { label: b.label, action: b.action ?? 'button:click' },
    semantic: baseSemantic(b),
    interaction: interactionFromList(b.interaction),
    style: styleFromBase(b),
    children: [],
  };
}

function convertViewRef(vr: ViewRef, spaceId: string): SceneNode {
  return {
    id: vr.id ?? `ref-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Panel', space: spaceId,
    geometry: {},
    content: { title: `[view_ref: ${vr.view}]` },
    semantic: undefined,
    interaction: defaultInteraction(),
    style: { emphasis: 'subtle', opacity: 0.5, depth: 1, visible: true },
    children: [],
  };
}

function convertCustom(cu: Custom, spaceId: string): SceneNode {
  const nodeId = cu.id ?? `custom-${Math.random().toString(36).slice(2, 8)}`;
  if (cu.type === 'image' || cu.type === 'Image') {
    const props = cu.props as Record<string, unknown> | undefined;
    return {
      id: nodeId, type: 'Image', space: spaceId,
      geometry: { width: (props?.width ?? 200) as number, height: (props?.height ?? 200) as number, fit: 'contain' },
      content: { src: (props?.src ?? '') as string, alt: (props?.alt ?? '') as string },
      semantic: baseSemantic({ id: nodeId }),
      interaction: defaultInteraction(),
      style: defaultStyle(),
      children: [],
    };
  }
  // Generic custom -> Code node
  return {
    id: nodeId, type: 'Code', space: spaceId,
    geometry: { language: cu.type ?? 'text' },
    content: { source: JSON.stringify(cu.props, null, 2) },
    semantic: baseSemantic({ id: nodeId }),
    interaction: defaultInteraction(),
    style: defaultStyle(),
    children: [],
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function interactionFromList(list: string[] | undefined) {
  if (!list || list.length === 0) return defaultInteraction();
  const s = new Set(list);
  return {
    hover: s.has('hover'), select: s.has('select'), drag: s.has('drag'),
    focus: s.has('focus'), inspect: s.has('inspect'), edit: s.has('edit'),
  };
}

function styleFromBase(n: { style?: Record<string, string | number> }) {
  if (!n.style || Object.keys(n.style).length === 0) return defaultStyle();
  return {
    emphasis: 'default' as const,
    opacity: (n.style.opacity as number) ?? 1,
    depth: (n.style.depth as number) ?? 0,
    visible: n.style.visible !== undefined ? (n.style.visible !== 'false' && n.style.visible !== 0) : true,
  };
}

function convertPresentation(ps: import('./types.js').PresentationState): ScenePresentationState {
  const anns: SceneAnnotation[] = (ps.annotations ?? []).map(a => ({
    id: `ann-${a.target}`,
    target: a.target,
    text: a.content,
    position: (a.position === 'top' ? 'above' : a.position === 'bottom' ? 'below' : a.position as 'left' | 'right' | 'center') ?? 'above',
    style: 'callout' as const,
  }));

  const overrides: Record<string, { emphasis: string; opacity: number }> = {};
  if (ps.highlights) {
    for (const id of ps.highlights) {
      overrides[id] = { emphasis: 'primary', opacity: 1 };
    }
  }
  if (ps.isolation) {
    // isolations override others with dim
    const isoSet = new Set(ps.isolation);
    // This is best-effort: we mark isolated as primary, others as subtle
    for (const id of isoSet) {
      overrides[id] = { emphasis: 'primary', opacity: 1 };
    }
  }

  return {
    focus_entity: ps.camera?.target,
    selection: [],
    camera: undefined,
    overrides,
    annotations: anns,
    animations: [],
  };
}
