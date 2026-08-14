export { render, registerRenderer, isSceneDocument, renderSceneNode } from './render.js';
export { renderSceneDocument, renderSceneRelations, is2DSceneDocument } from './render.js';
export { injectBaseStyles } from './styles.js';
export { resolveRefs, evaluateDerived, isVisualDoc } from './state.js';
export { resolveSpaces, createSpaceContainer, groupNodesBySpace, getSpaceForNode } from './spaceResolver.js';
export { applyBillboard, billboardCssClass, billboardTransform } from './billboardHandler.js';
export { applyPresentationState, clearPresentationState } from './presentationEngine.js';
export { convertVisualDocToSceneDocument } from './convertVisualDocToSceneDocument.js';
export { computeDiagramLayout } from './diagramLayout.js';
export { createScale, applyEncoding, resolveChannel, lookupPath, resolveChannelValue, SCHEMES } from './scale.js';
export type { LayoutBox } from './diagramLayout.js';
export { codebaseMapExample, neuralNetExample, champsUiExample } from './examples.js';

// ── SceneDocument types (v1.0) ──────────────────────────────────────────────
export type {
  SceneDocument, SceneNode, SceneRelation, SceneRelationStyle,
  ScenePresentationState, SceneAnnotation, SceneAnimationClip,
  Space, SpaceType, SpaceLayout, Camera, CameraPose, GridHint,
  NodeType, Transform, Orient, LayoutHint, DataBinding,
  NodeSemantic, NodeInteraction, NodeStyle, NodeDimensions,
  ShapeType, Port, ScaleType, ScaleDef, ChannelSpec, Encoding,
  LayoutAlgorithm, DiagramLayout,
  CameraOverride, StyleOverride, PatchOp, PatchDocument,
} from './types.js';

// ── Dimensionality tables (2D vs 3D document model) ─────────────────────────
export { NODE_DIMENSIONS, SPACE_DIMENSIONS } from './types.js';

// ── Shared types ────────────────────────────────────────────────────────────
export type {
  View, FocusState, RendererContext, RendererFn, RenderInput,
  SelectionContext,
} from './types.js';

// ── Legacy types (deprecated) ───────────────────────────────────────────────
export type {
  Visual, VisualDoc, ResolvedDoc, ResolvedView,
  NodeBase, Panel, Text, ViewRef, Math, Chart, Matrix, Table, Graph, Form, Button, Custom,
  Series, GraphNode, GraphEdge, Field,
  Layout, ViewDef, Control, Relation,
  Semantic, PresentationState, Annotation,
  Mutation, AIResponse,
} from './types.js';
