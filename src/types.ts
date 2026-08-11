// ============================================================================
// SceneDocument — Unified type schema (v1.0)
// Mirror of C++ types in extropian-semantic-to-visual/include/exd/types/scene_document.hpp
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
  projection: 'orthographic' | 'perspective';
  background: string;
  camera?: Camera;
  grid?: GridHint;
  scroll: boolean;
}

// ── Node types ──────────────────────────────────────────────────────────────

export type NodeType =
  | 'Panel' | 'Text' | 'Equation' | 'Matrix' | 'Plot'
  | 'Vector' | 'Curve' | 'Mesh' | 'Volume' | 'Label'
  | 'Graph' | 'Code' | 'Image' | 'Viewport' | 'Group'
  | 'Table' | 'Form' | 'Button';

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
  bind: string;
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
  emphasis: 'subtle' | 'default' | 'primary' | 'prominent';
  opacity: number;
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
  emphasis: string;
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
  state: Record<string, unknown>;
  data_sources: Record<string, unknown>;
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
  setState(path: string, value: unknown): void;
  unmount(): void;
}
