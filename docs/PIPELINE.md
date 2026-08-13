# SceneDocument → DOM Pipeline

The full render pipeline from `SceneDocument` (JSON) to interactive DOM elements.

## Entry Point

```ts
import { render } from 'extropian-web-ui';

const view = render(sceneDocument, container);
// view: View — root, on(), find(), setState(), setFocus(), unmount()
```

## 2D vs 3D dispatch

`Space.projection` is the backend switch: **orthographic = fixed 2D** (native
DOM/CSS + d3 SVG, the primary web path) and **perspective = camera-based 3D**
(placeholder until the 3D renderer lands). Node dimensionality is table-driven
(`NODE_DIMENSIONS` / `SPACE_DIMENSIONS` in `src/types.ts`); placement is
validated at render. See `CONTRACT.md` §18 for the full tables and rules.

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
             │   │                                  Partitions top-level nodes by space; children
             │   │                                  render inline inside their parent (DOM nesting)
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
               ├─ placement validation      node dimension (NODE_DIMENSIONS[type]) vs
               │                            space dimension (SPACE_DIMENSIONS[space])
               │                            3D node → placeholder + console.warn
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

> **Note on interaction wiring:** the "Status" column above reflects
> content/geometry rendering only, not `SceneNode.interaction`. Of the 6
> `NodeInteraction` booleans (`hover`, `select`, `drag`, `focus`, `inspect`,
> `edit`), `applySceneNodeAttrs()` only reads `select`/`focus`/`inspect`, and
> only to set `cursor: pointer` + `tabIndex = 0`. `hover`, `drag`, and `edit`
> are not read anywhere else in the SceneNode pipeline. The only components
> with real interactive behavior are `button.ts` (click → `ctx.emit`) and
> `graph.ts` (d3-force drag) — and both are unconditional, i.e. neither
> actually checks `node.interaction` before wiring up the handler. Every
> other node type has no interaction behavior regardless of what its
> `interaction` flags say.

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
SceneDocument.nodes ─────────► resolveRefs(nodes, state)   ($ref → value)
                                   │
SceneNode.data.bind ──────────► applyDataBinding()            (inject into content)
                                   │
SceneDocument.presentation ──► applyPresentationState()
                                   │
User interaction ───────────► ctx.emit(action, payload)
                                   │
                              ViewImpl._handlers[action]
                                   │
                              User callback (via view.on())
                                   │
view.setState(path, value) ──► mutate _state → targeted update
                                   (re-render only dependent nodes, by id)
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
