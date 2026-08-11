# SceneDocument → DOM Pipeline

The full render pipeline from `SceneDocument` (JSON) to interactive DOM elements.

## Entry Point

```ts
import { render } from 'extropian-web-ui';

const view = render(sceneDocument, container);
// view: View — root, on(), find(), setState(), setFocus(), unmount()
```

## Pipeline Trace

```
render(sceneDocument, container)
  │
  └─ ViewImpl constructor
       │
       ├─ isSceneDocument(input)                  type guard: checks spaces, nodes, state, data_sources
       │
       └─ _renderSceneDocument()
            │
            ├─ resolveSpaces(doc.spaces)          Space[] → Map<id, ResolvedSpace>
            │   │                                  CSS position, size, background, overflow per space type
            │   │                                  Screen → static, Panel → relative, Overlay → absolute
            │   │
            ├─ groupNodesBySpace(doc.nodes)        SceneNode[] → Map<spaceId, SceneNode[]>
            │   │                                  Recursively walks node tree, partitions by space
            │   │
            ├─ createSpaceContainer(space)         ResolvedSpace → HTMLElement
            │   │                                  Creates positioned div per space with CSS classes
            │   │
            └─ for each space → for each node:
                 │
                 └─ renderSceneNode(node, ctx)
                      │
                      ├─ visibility check          skips node if style.visible === false
                      │
                      ├─ sceneRendererRegistry.get(node.type)()
                      │   │
                      │   └─ Adapts SceneNode geometry/content → legacy Visual type
                      │       → existing component renderer
                      │
                      ├─ applySceneNodeAttrs()      data-exd-id, data-node-type, data-space,
                      │                              data-semantic-*, title tooltip, tabindex
                      │
                      ├─ applyBillboard()            adds orient CSS class, transform (stub for 2D)
                      │
                      └─ applyNodeStyle()            emphasis box-shadow, opacity
            │
            └─ applyPresentationState()             focus glow, style overrides, annotations, animations
```

## NodeType → Component Mapping

| NodeType | Adapter | Component | Lazy Load | Status |
|----------|---------|-----------|-----------|--------|
| `Panel` | SceneNode → Panel (Visual) | `panel.ts` | — | ✅ |
| `Text` | SceneNode → Text (Visual) | `text.ts` | — | ✅ |
| `Code` | SceneNode → Text.variant=code | `text.ts` | — | ✅ |
| `Equation` | SceneNode → Math (Visual) | `math.ts` | KaTeX | ✅ |
| `Plot` | SceneNode → Chart (Visual) | `chart.ts` | d3 (scale, shape, axis) | ✅ |
| `Matrix` | SceneNode → Matrix (Visual) | `matrix.ts` | — | ✅ |
| `Table` | SceneNode → Table (Visual) | `table.ts` | — | ✅ |
| `Graph` | SceneNode → Graph (Visual) | `graph.ts` | d3-force, d3-zoom | ✅ |
| `Form` | SceneNode → Form (Visual) | `form.ts` | — | ✅ |
| `Button` | SceneNode → Button (Visual) | `button.ts` | — | ✅ |
| `Image` | Direct | `image.ts` | — | ✅ |
| `Group` | Pass-through wrapper | inline | — | ✅ |
| `Label` | Placeholder | inline | — | ⏳ v0.2 |
| `Vector` | Placeholder | inline | — | ⏳ v0.2 |
| `Curve` | Placeholder | inline | — | ⏳ v0.2 |
| `Mesh` | Placeholder | inline | — | ⏳ v0.2 |
| `Volume` | Placeholder | inline | — | ⏳ v0.2 |
| `Viewport` | Placeholder | inline | — | ⏳ v0.2 |

## Key Files

| File | Role |
|------|------|
| `src/types.ts` | All type definitions — SceneDocument types (v1.0) + legacy types (@deprecated) |
| `src/render.ts` | Main entry: `render()`, `ViewImpl`, `renderSceneNode()`, `isSceneDocument()`, sceneRendererRegistry |
| `src/spaceResolver.ts` | Space → CSS container mapping, node grouping by space |
| `src/billboardHandler.ts` | Orient mode handling (stub for 2D DOM) |
| `src/presentationEngine.ts` | Focus glow, style overrides, annotations, animations |
| `src/convertVisualDocToSceneDocument.ts` | Legacy `VisualDoc` → `SceneDocument` migration |
| `src/state.ts` | Expression parser, `$ref` resolver, derived evaluator (used by legacy path) |
| `src/layout.ts` | Layout tree → DOM (used by legacy path) |
| `src/styles.ts` | Base CSS injection |
| `src/index.ts` | Public API exports |
| `src/components/*.ts` | Individual node renderers |

## State / Interaction

```
SceneDocument.state ───────► cloned into ViewImpl._state
                                   │
SceneDocument.presentation ──► applyPresentationState()
                                   │
User interaction ───────────► ctx.emit(action, payload)
                                   │
                              ViewImpl._handlers[action]
                                   │
                              User callback (via view.on())
```

## Backward Compatibility

The `render()` function also accepts legacy `Visual` and `VisualDoc` inputs:

```
render(visual: Visual, container)  ──►  renderNode() → legacy component renderer
render(doc: VisualDoc, container)  ──►  _resolveAndRender() → renderLayout() / renderNode()
render(doc: SceneDocument, ...)    ──►  _renderSceneDocument() (documented above)
```

Or explicitly convert old presets:

```ts
import { convertVisualDocToSceneDocument } from 'extropian-web-ui';
const sceneDoc = convertVisualDocToSceneDocument(legacyVisualDoc);
```
