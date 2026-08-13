// ============================================================================
// SceneDocument — Unified type schema (v1.0)
//
// Mirror of the C++ structs in extropian-core/include/exd/types/
// (scene_document.hpp, presentation_state.hpp). The C++ structs are the
// authority; this file is a hand-kept mirror aligned by review (there is no
// shared test fixture harness). JSON wire names match the C++ field names.
// ============================================================================

// ── Space types ─────────────────────────────────────────────────────────────

export type SpaceType = 'screen' | 'panel' | 'cartesian2d' | 'viewport3d' | 'world3d' | 'overlay';

export interface CameraPose {
  look_at: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
}

export interface Camera {
  projection: 'perspective' | 'orthographic';
  fov: number;
  near_plane: number;
  far_plane: number;
  pose: CameraPose;
}

export interface GridHint {
  visible: boolean;
  size: number;
  subdivisions: number;
}

export interface SpaceLayout {
  x: string;
  y: string;
  width: string;
  height: string;
}

export interface Space {
  id: string;
  type: SpaceType;
  parent?: string;
  layout?: SpaceLayout;
  /** `orthographic` = fixed 2D canvas (web-native); `perspective` = camera-based 3D. */
  projection: 'orthographic' | 'perspective';
  background: string;
  camera?: Camera;
  grid?: GridHint;
  scroll: boolean;
  /** How child nodes are arranged (layered/tree/treemap/pack/…); 2D diagrams. */
  arrangement?: DiagramLayout;
}

// ── Diagram primitives — shapes, ports, encoding, layout ─────────────────────

/** 2D geometric shape vocabulary (used by `SceneNode{type:'Shape'}`). */
export type ShapeType =
  | 'Rect' | 'RoundedRect' | 'Circle' | 'Ellipse' | 'Diamond'
  | 'Hexagon' | 'Parallelogram' | 'Triangle' | 'Pill' | 'Cylinder'
  | 'Stack' | 'Grid' | 'Strip' | 'Document';

/** Connection point on a node, for edge routing. */
export interface Port {
  id: string;
  side: 'north' | 'east' | 'south' | 'west';
  /** 0..1 along the side (0 = left/top). */
  position: number;
}

export type ScaleType = 'linear' | 'log' | 'sqrt' | 'threshold' | 'quantize' | 'ordinal';

/**
 * A named scale mapping a metric domain to a visual range. Shared across nodes
 * so "color = complexity" stays consistent and legend-able.
 */
export interface ScaleDef {
  id: string;
  type: ScaleType;
  /** Color scheme: `viridis | magma | inferno | plasma | blues | diverging | category10 | category20` (empty = none). */
  scheme: string;
  /** `[min,max]` or `[category,...]`. */
  domain: unknown;
  /** `[min,max]` (size/opacity) or `[color,...]`; optional. */
  range: unknown;
}

/** Binds one visual channel to a data field, scaled by a named `ScaleDef`. */
export interface ChannelSpec {
  /** Data path, e.g. `"metrics.code_size"`. */
  source: string;
  /** id of a `ScaleDef` in `SceneDocument.scales`. */
  scale?: string;
}

/** Per-node visual encoding: metric → visual channel. */
export interface Encoding {
  size?: ChannelSpec;
  color?: ChannelSpec;
  opacity?: ChannelSpec;
  shape?: ChannelSpec;
  label?: ChannelSpec;
  edge_width?: ChannelSpec;
}

export type LayoutAlgorithm =
  | 'manual' | 'grid' | 'layered' | 'tree' | 'radial'
  | 'force' | 'treemap' | 'pack' | 'swimlane' | 'timeline';

/** Container-level layout: how a space arranges its child nodes. */
export interface DiagramLayout {
  algorithm: LayoutAlgorithm;
  /** treemap/pack: channel driving area. */
  size_by?: ChannelSpec;
  /** Optional channel driving child color. */
  color_by?: ChannelSpec;
  /** swimlane: channel grouping nodes into lanes. */
  lane_by?: ChannelSpec;
  /** timeline: channel positioning nodes on the time axis. */
  time_by?: ChannelSpec;
  /** Algorithm-specific params: orientation, rankdir, gap, cols, node_width, … */
  params: Record<string, unknown>;
}

// ── Node types ──────────────────────────────────────────────────────────────

export type NodeType =
  | 'Panel' | 'Text' | 'Equation' | 'Matrix' | 'Plot'
  | 'Vector' | 'Curve' | 'Mesh' | 'Volume' | 'Label'
  | 'Graph' | 'Code' | 'Image' | 'Viewport' | 'Group'
  | 'Table' | 'Form' | 'Button' | 'Shape' | 'Legend';

// ── 2D vs 3D dimensionality (table-driven — single source of truth) ─────────
//
// The document has no explicit "dimensions" field. A node's dimensionality is
// derived from its `type`; a space's from its `type` (+ `projection`).
// See docs/CONTRACT.md §18 for the full rules.

/** Dimensionality of a node or space. `both` = same concept, per-backend geometry. */
export type NodeDimensions = '2d' | '3d' | 'both';

/** Space dimensionality by SpaceType. Orthographic = 2D, perspective = 3D. */
export const SPACE_DIMENSIONS: Record<SpaceType, '2d' | '3d'> = {
  screen: '2d',
  panel: '2d',
  cartesian2d: '2d',
  overlay: '2d',
  viewport3d: '3d',
  world3d: '3d',
};

/**
 * Node dimensionality by NodeType.
 * - 2d:    web-native UI/UX + d3 SVG (fully rendered by the DOM backend)
 * - both:  same concept, per-backend geometry (Label = billboard text in 3D)
 * - 3d:    3D-only; placeholder in the web backend until the 3D renderer lands
 */
export const NODE_DIMENSIONS: Record<NodeType, NodeDimensions> = {
  Panel: '2d',
  Text: '2d',
  Code: '2d',
  Equation: '2d',
  Matrix: '2d',
  Plot: '2d',
  Table: '2d',
  Form: '2d',
  Button: '2d',
  Image: '2d',
  Shape: '2d',
  Legend: '2d',
  Label: 'both',
  Vector: 'both',
  Curve: 'both',
  Graph: 'both',
  Group: 'both',
  Mesh: '3d',
  Volume: '3d',
  Viewport: '3d',
};

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  anchor: string;
}

export interface Orient {
  mode: 'fixed' | 'billboard' | 'billboard_y';
  face: string;
}

export interface LayoutHint {
  strategy: 'row' | 'column' | 'grid' | 'absolute' | 'stack' | 'overlay';
  gap: number;
  padding: number;
  alignment: 'start' | 'center' | 'end' | 'stretch';
  min_width?: number;
  max_width?: number;
}

export interface DataBinding {
  /** Named data source: a key in `SceneDocument.data_sources` (falls back to `state`). */
  bind: string;
  /** Subpath into the bound value, e.g. `"[0][0]"` or `".values"`. */
  path?: string;
}

export interface NodeSemantic {
  role: string;
  /** Named concept_id (matches C++ — renamed from 'concept' for C++20 keyword conflict) */
  concept_id: string;
  kind: string;
  explanation: string;
  tags: string[];
}

export interface NodeInteraction {
  hover: boolean;
  select: boolean;
  drag: boolean;
  focus: boolean;
  inspect: boolean;
  edit: boolean;
}

export interface NodeStyle {
  /** Canonical emphasis vocabulary (shared with {@link StyleOverride}): `subtle` (dimmed) → `default` → `primary` → `prominent`. */
  emphasis: 'subtle' | 'default' | 'primary' | 'prominent';
  opacity: number;
  /** Visual depth for 3D layering; unused by the 2D web backend. */
  depth: number;
  visible: boolean;
}

export interface SceneNode {
  id: string;
  type: NodeType;
  space: string;
  transform?: Transform;
  orient?: Orient;
  layout?: LayoutHint;
  geometry: Record<string, unknown>;
  content: Record<string, unknown>;
  data?: DataBinding;
  semantic?: NodeSemantic;
  /** Visual encoding: metric → channel (size/color/shape/…). */
  encode?: Encoding;
  /** Connection points for edge routing. Omitted = no ports. */
  ports?: Port[];
  interaction: NodeInteraction;
  style: NodeStyle;
  children: SceneNode[];
}

// ── Relations ───────────────────────────────────────────────────────────────

export interface SceneRelationStyle {
  type: 'arrow' | 'line' | 'tube' | 'bezier' | 'elbow';
  color: string;
  width: number;
  dash: boolean;
}

export interface SceneRelation {
  id: string;
  source: string;
  target: string;
  source_port?: string;
  target_port?: string;
  style: SceneRelationStyle;
  label?: { text: string; position: 'start' | 'middle' | 'end' };
  semantic?: { kind: string };
}

// ── Presentation state (v1.0) ───────────────────────────────────────────────

export interface CameraOverride {
  space: string;
  pose?: CameraPose;
}

export interface StyleOverride {
  /** Same vocabulary as {@link NodeStyle.emphasis}; runtime overrides default to `subtle` (dim). */
  emphasis: 'subtle' | 'default' | 'primary' | 'prominent';
  opacity: number;
}

export interface SceneAnnotation {
  id: string;
  target: string;
  text: string;
  position: 'above' | 'below' | 'left' | 'right' | 'center';
  style: 'callout' | 'tooltip' | 'label';
}

export interface SceneAnimationClip {
  target: string;
  effect: 'pulse' | 'highlight' | 'fade_in' | 'fade_out' | 'slide_in' | 'scale_up';
  duration: number;
  easing: 'ease_out' | 'ease_in' | 'linear';
}

export interface ScenePresentationState {
  focus_entity?: string;
  selection: string[];
  camera?: CameraOverride;
  overrides: Record<string, StyleOverride>;
  annotations: SceneAnnotation[];
  animations: SceneAnimationClip[];
}

// ── Patch ops (AI mutation contract v1.0) ───────────────────────────────────

export interface PatchOp {
  op: 'isolate' | 'camera_focus' | 'annotate' | 'dim' | 'highlight' | 'reveal' | 'conceal' | 'scrub' | 'sequence' | 'reset';
  target: string;
  params: Record<string, unknown>;
}

export interface PatchDocument {
  ops: PatchOp[];
}

// ── Top-level SceneDocument ─────────────────────────────────────────────────

export interface SceneDocument {
  version: number;
  topic: string;
  spaces: Space[];
  nodes: SceneNode[];
  relations: SceneRelation[];
  presentation?: ScenePresentationState;
  /** Canonical reactive state — `$ref` strings in node content resolve against this. */
  state: Record<string, unknown>;
  /** Named data sources referenced by `DataBinding.bind`. */
  data_sources: Record<string, unknown>;
  /** Shared visual scales referenced by `Encoding`/`ChannelSpec.scale`. */
  scales?: ScaleDef[];
}

// ── Focus & selection ───────────────────────────────────────────────────────

export interface FocusState {
  view?: string;
  entity?: string;
  selection?: string[];
  hover?: string;
  path?: string[];
}

// ============================================================================
// Legacy types (deprecated — retained for backward compatibility)
// ============================================================================

// ── Legacy semantic metadata ────────────────────────────────────────────────

/** @deprecated Use {@link NodeSemantic} from the unified SceneDocument schema. */
export interface Semantic {
  role?: string;
  concept?: string;
  represents?: string;
  value?: string;
  units?: string;
  importance?: 'primary' | 'secondary' | 'detail';
  explanation?: string;
  related?: string[];
  source?: string;
  category?: string;
}

// ── Legacy sub-types ────────────────────────────────────────────────────────

/** @deprecated Use Plot geometry.series in SceneNode. */
export interface Series {
  name?: string;
  x?: number[];
  y: number[];
  type?: 'line' | 'scatter' | 'bar' | 'area';
  color?: string;
}

/** @deprecated Use SceneNode with type 'Graph'. */
export interface GraphNode {
  id: string;
  label?: string;
  semantic?: Semantic;
  interaction?: string[];
}

/** @deprecated Use SceneNode with type 'Graph'. */
export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

/** @deprecated Use SceneNode with type 'Form'. */
export interface Field {
  name: string;
  label?: string;
  type: 'number' | 'text' | 'complex' | 'select' | 'boolean' | 'range';
  value?: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  action?: string;
  /** Two-way state binding: read initial value from state and write on change. */
  bind?: string;
  semantic?: Semantic;
}

// ── Legacy node base ────────────────────────────────────────────────────────

/** @deprecated Use {@link SceneNode} from the unified SceneDocument schema. */
export interface NodeBase {
  id?: string;
  style?: Record<string, string | number>;
  action?: string;
  semantic?: Semantic;
  interaction?: string[];
}

// ── Legacy Visual discriminated union ───────────────────────────────────────

/** @deprecated Use {@link SceneDocument} with {@link SceneNode} trees. */
export type Visual =
  | Panel
  | Text
  | ViewRef
  | Math
  | Chart
  | Matrix
  | Table
  | Graph
  | Form
  | Button
  | Custom;

/** @deprecated Use {@link SceneNode} with type 'Panel'. */
export interface Panel extends NodeBase {
  kind: 'panel';
  layout?: 'row' | 'column' | 'grid';
  cols?: number;
  title?: string;
  children: Visual[];
}

/** @deprecated Use {@link SceneNode} with type 'Text'. */
export interface Text extends NodeBase {
  kind: 'text';
  text: string;
  variant?: 'heading' | 'body' | 'code' | 'label';
}

/** @deprecated Use a {@link SceneNode} via the layout tree. */
export interface ViewRef extends NodeBase {
  kind: 'view_ref';
  view: string;
}

/** @deprecated Use {@link SceneNode} with type 'Equation'. */
export interface Math extends NodeBase {
  kind: 'math';
  source: string;
  display?: boolean;
}

/** @deprecated Use {@link SceneNode} with type 'Plot'. */
export interface Chart extends NodeBase {
  kind: 'chart';
  type: 'line' | 'scatter' | 'bar' | 'area' | 'heatmap';
  series?: Series[];
  matrix?: number[][];
  x?: (string | number)[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

/** @deprecated Use {@link SceneNode} with type 'Matrix'. */
export interface Matrix extends NodeBase {
  kind: 'matrix';
  values: (number | string)[][];
  rowLabels?: string[];
  colLabels?: string[];
  editable?: boolean;
}

/** @deprecated Use {@link SceneNode} with type 'Table'. */
export interface Table extends NodeBase {
  kind: 'table';
  columns?: string[];
  rows: (string | number)[][];
}

/** @deprecated Use {@link SceneNode} with type 'Graph'. */
export interface Graph extends NodeBase {
  kind: 'graph';
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** @deprecated Use {@link SceneNode} with type 'Form'. */
export interface Form extends NodeBase {
  kind: 'form';
  fields: Field[];
}

/** @deprecated Use {@link SceneNode} with type 'Button'. */
export interface Button extends NodeBase {
  kind: 'button';
  label: string;
}

/** @deprecated Use {@link SceneNode} with type 'Code' or 'Image'. */
export interface Custom extends NodeBase {
  kind: 'custom';
  type: string;
  props?: unknown;
}

// ── Legacy view definitions ─────────────────────────────────────────────────

/** @deprecated Use {@link SceneNode} with nested children. */
export interface ViewDef {
  id: string;
  type?: string;
  title?: string;
  objects?: Visual[];
  content?: Visual;
  children?: Layout[];
  semantic?: Semantic;
  interaction?: string[];
}

// ── Legacy layout tree ──────────────────────────────────────────────────────

/** @deprecated Use {@link LayoutHint} on {@link SceneNode}. */
export type Layout =
  | { type: 'split'; direction: 'horizontal' | 'vertical'; ratio?: number[]; children: (string | Layout)[] }
  | { type: 'stack'; children: (string | Layout)[] }
  | { type: 'tabs'; tabs: { label: string; content: string | Layout }[] }
  | { type: 'overlay'; base: string | Layout; overlays: { id: string; position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'; content: string | Layout }[] }
  | { type: 'row'; children: (string | Layout)[] }
  | { type: 'column'; children: (string | Layout)[] }
  | { type: 'grid'; cols?: number; children: (string | Layout)[] }
  | string;

// ── Legacy controls ─────────────────────────────────────────────────────────

/** @deprecated Use a {@link SceneNode} with type 'Form'. */
export type Control =
  | { type: 'slider'; id: string; label?: string; bind: string; min?: number; max?: number; step?: number }
  | { type: 'number_input'; id: string; label?: string; bind: string; min?: number; max?: number; step?: number }
  | { type: 'range_slider'; id: string; label?: string; bind: string; min?: number; max?: number }
  | { type: 'toggle'; id: string; label?: string; bind: string }
  | { type: 'checkbox'; id: string; label?: string; bind: string }
  | { type: 'radio'; id: string; label?: string; bind: string; options: string[] }
  | { type: 'select'; id: string; label?: string; bind: string; options: string[] }
  | { type: 'segmented_control'; id: string; label?: string; bind: string; options: string[] }
  | { type: 'button'; id: string; label: string; action?: string }
  | { type: 'button_group'; id: string; buttons: { label: string; action?: string }[] }
  | { type: 'matrix_editor'; id: string; label?: string; bind: string; value?: number[][] }
  | { type: 'play_pause'; id: string; bind: string }
  | { type: 'step_forward'; id: string; action?: string }
  | { type: 'step_backward'; id: string; action?: string }
  | { type: 'scrubber'; id: string; bind: string; min?: number; max?: number }
  | { type: 'reset'; id: string }
  | { type: 'drag_point'; id: string; bind: string; axis?: 'x' | 'y' | 'both' }
  | { type: 'visibility_toggle'; id: string; label?: string; bind: string }
  | { type: 'tabs'; id: string; tabs: { label: string; content: string | Layout }[] };

// ── Legacy relations ────────────────────────────────────────────────────────

/** @deprecated Use {@link SceneRelation} from the unified SceneDocument schema. */
export interface Relation {
  from: string;
  to: string;
  type: 'depends_on' | 'derived_from' | 'transforms' | 'maps_to' | 'contains' |
        'part_of' | 'causes' | 'controls' | 'corresponds_to' | 'scaled_by' |
        'computed_by' | 'flows_to' | 'reads_from' | 'writes_to' | 'related_to' |
        'eigenvector_of' | 'output_of' | 'input_to';
  label?: string;
}

// ── Legacy presentation ─────────────────────────────────────────────────────

/** @deprecated Use {@link ScenePresentationState} from the unified SceneDocument schema. */
export interface PresentationState {
  highlights?: string[];
  isolation?: string[];
  annotations?: Annotation[];
  camera?: { target?: string; zoom?: number };
}

/** @deprecated Use {@link SceneAnnotation}. */
export interface Annotation {
  target: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// ── Legacy roots ────────────────────────────────────────────────────────────

/** @deprecated Use {@link SceneDocument}. */
export interface VisualDoc {
  version?: number;
  topic?: string;
  state?: Record<string, unknown>;
  derive?: Record<string, string>;
  layout?: Layout;
  views?: ViewDef[];
  controls?: Control[];
  relations?: Relation[];
  presentation?: PresentationState;
  root?: Visual;
}

/** @deprecated Internal use only — uses SceneDocument render path now. */
export interface ResolvedDoc {
  topic?: string;
  state: Record<string, unknown>;
  derived: Record<string, unknown>;
  layout?: Layout;
  views: Map<string, ResolvedView>;
  controls?: Control[];
  relations?: Relation[];
  presentation?: PresentationState;
}

/** @deprecated Internal use only. */
export interface ResolvedView {
  id: string;
  type?: string;
  title?: string;
  objects: Visual[];
  semantic?: Semantic;
  interaction?: string[];
}

// ── Legacy AI mutation ──────────────────────────────────────────────────────

/** @deprecated Use {@link PatchOp} from the unified SceneDocument schema. */
export type Mutation =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'increment'; path: string; delta?: number }
  | { op: 'reset'; path?: string }
  | { op: 'highlight'; target: string }
  | { op: 'emphasize'; target: string }
  | { op: 'deemphasize'; target: string }
  | { op: 'isolate'; target: string }
  | { op: 'select'; target: string }
  | { op: 'focus'; target: string }
  | { op: 'reveal'; target: string }
  | { op: 'annotate'; target: string; content: string; position?: string }
  | { op: 'show_equation'; target: string; content: string }
  | { op: 'animate'; target: string; animation: string }
  | { op: 'play' } | { op: 'pause' } | { op: 'seek'; time: number }
  | { op: 'add_view'; view: ViewDef }
  | { op: 'remove_view'; id: string }
  | { op: 'add_object'; target: string; object: Visual }
  | { op: 'remove_object'; target: string; id: string };

/** @deprecated Use the unified SceneDocument type. */
export interface AIResponse {
  answer?: string;
  mutations?: Mutation[];
}

// ============================================================================
// Renderer interfaces (unified)
// ============================================================================

export interface RendererContext {
  render: (v: Visual) => HTMLElement;
  /** Render a SceneNode using the unified schema. */
  renderNode?: (node: SceneNode) => HTMLElement;
  emit: (action: string, payload: unknown) => void;
  focus: (entityId: string, isSelection?: boolean) => void;
  getFocus: () => FocusState;
  getState: () => Record<string, unknown>;
  /** Reactive state write (e.g. from a bound form field); triggers a re-render. */
  setState: (path: string, value: unknown) => void;
  /** Named visual scales (SceneDocument.scales) for legend/encoding renderers. */
  getScales: () => Map<string, ScaleDef>;
}

export type RendererFn = (spec: unknown, ctx: RendererContext) => HTMLElement;

/** Union of all supported render inputs. */
export type RenderInput = Visual | VisualDoc | SceneDocument;

export interface View {
  root: HTMLElement;
  on(action: string, handler: (payload: unknown) => void): () => void;
  find(id: string): HTMLElement | null;
  update(visual: Visual): void;
  updateDocument(doc: VisualDoc): void;
  /** Render a SceneDocument using the unified schema. */
  renderSceneDocument?(doc: SceneDocument): void;
  getFocus(): FocusState;
  setFocus(focus: Partial<FocusState>): void;
  getState(): Record<string, unknown>;
  /**
   * Write to reactive state. For a SceneDocument this is a targeted update —
   * only nodes whose content references the changed key are re-rendered.
   */
  setState(path: string, value: unknown): void;
  unmount(): void;
}
