export { render, registerRenderer, isSceneDocument, renderSceneNode } from './render.js';
export { injectBaseStyles } from './styles.js';
export { resolveRefs, evaluateDerived, isVisualDoc } from './state.js';
export { resolveSpaces, createSpaceContainer, groupNodesBySpace, getSpaceForNode } from './spaceResolver.js';
export { applyBillboard, billboardCssClass, billboardTransform } from './billboardHandler.js';
export { applyPresentationState, clearPresentationState } from './presentationEngine.js';
export { convertVisualDocToSceneDocument } from './convertVisualDocToSceneDocument.js';

// ── SceneDocument types (v1.0) ──────────────────────────────────────────────
export type {
  SceneDocument, SceneNode, SceneRelation, SceneRelationStyle,
  ScenePresentationState, SceneAnnotation, SceneAnimationClip,
  Space, SpaceType, SpaceLayout, Camera, CameraPose, GridHint,
  NodeType, Transform, Orient, LayoutHint, DataBinding,
  NodeSemantic, NodeInteraction, NodeStyle,
  CameraOverride, StyleOverride, PatchOp, PatchDocument,
} from './types.js';

// ── Shared types ────────────────────────────────────────────────────────────
export type {
  View, FocusState, RendererContext, RendererFn, RenderInput,
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
