# Extropian Web UI — Visual Scene Document → Interactive DOM

> **v0.3 (implemented):** Types aligned with the unified SceneDocument schema
> defined in `extropian-semantic-to-visual/compiler/docs/compiler-plan.md` §12.
> TypeScript types in `src/types.ts` mirror the canonical C++ structs.
> New modules: `spaceResolver`, `billboardHandler`, `presentationEngine`,
> `convertVisualDocToSceneDocument`, `components/image`.
> Legacy `Visual`/`VisualDoc` types retained as `@deprecated`.
>
> AI-emitted declarative JSON → interactive DOM.
> One contract, two backends (TypeScript DOM + C++ OpenGL).

---

## 1. Overview

**`extropian-web-ui`** is a zero-framework TypeScript library. An AI (or human) emits a single JSON object describing *what* to visualize — equations, charts, matrices, graphs, forms, tables — and `render()` draws it to the DOM using KaTeX (math), d3 (charts, force graphs), and vanilla CSS. There is no WebGL, no class-based builder API, no manual DOM manipulation.

Two formats share the same `render()` entry point:

| Format | Purpose |
|--------|---------|
| **`Visual`** (flat) | Quick single-panel document. A discriminated union of 11 `kind` values. |
| **`VisualDoc`** (full) | Reactive document with canonical `state`, computed `derive`, layout tree, semantic metadata, controls, relations, focus tracking, and presentation annotations. |

`render()` returns a `View` handle with `.on()`, `.find()`, `.update()`, `.updateDocument()`, `.getState()`, `.setState()`, `.setFocus()`, `.getFocus()`, `.unmount()`.

### Installation

```bash
cd extropian-web-ui && npm install
cd extropian-composer-web && npm install
cd extropian-composer-web && npm run dev   # → http://localhost:3000
```

### Quick start

```ts
import { render, injectBaseStyles } from 'extropian-web-ui';

injectBaseStyles();

const view = render({
  kind: 'panel',
  title: 'Hello',
  children: [
    { kind: 'math', source: '\\nabla \\cdot \\mathbf{u} = 0' },
    { kind: 'chart', type: 'line', series: [{ y: [1, 3, 2, 5, 4] }] },
  ],
}, document.body);

view.on('*', (payload) => console.log('action:', payload));
view.on('button:submit', (data) => fetch('/api', { body: JSON.stringify(data) }));
```

---

## 2. The two document formats

### 2.1 Flat `Visual` (backward compatible)

A single discriminated union. One container kind (`panel`) nests other kinds.

```ts
type Visual =
  | Panel | Text | ViewRef | Math | Chart | Matrix
  | Table | Graph | Form | Button | Custom;
```

Every kind inherits from `NodeBase`:

```ts
interface NodeBase {
  id?: string;
  style?: Record<string, string | number>;   // pass-through CSS
  action?: string;                            // declarative event name
  semantic?: Semantic;                        // meaning, not appearance
  interaction?: string[];                     // hover, select, drag, focus, inspect
}
```

**All kinds at a glance:**

| Kind | Key properties | Renders with |
|------|---------------|-------------|
| `panel` | `layout: 'row'\|'column'\|'grid'`, `cols?`, `title?`, `children: Visual[]` | CSS flex/grid |
| `text` | `text: string`, `variant?: 'heading'\|'body'\|'code'\|'label'` | `<h2>` / `<div>` / `<pre>` |
| `math` | `source: string` (LaTeX), `display?: boolean` | KaTeX (lazy-loaded) |
| `chart` | `type: 'line'\|'scatter'\|'bar'\|'area'\|'heatmap'`, `series?`, `matrix?`, labels | d3 SVG (lazy-loaded) |
| `matrix` | `values: (number\|string)[][]`, `rowLabels?`, `colLabels?`, `editable?` | HTML `<table>` |
| `table` | `columns?: string[]`, `rows: (string\|number)[][]` | HTML `<table>` |
| `graph` | `nodes: GraphNode[]`, `edges: GraphEdge[]` | d3-force + SVG (lazy-loaded) |
| `form` | `fields: Field[]` (number, text, complex, select, boolean, range) | HTML inputs |
| `button` | `label: string` | HTML `<button>` |
| `custom` | `type: string`, `props?: unknown` | `registerRenderer(type, fn)` |
| `view_ref` | `view: string` | Placeholder; resolved by layout tree |

### 2.2 Full `VisualDoc` (reactive)

```ts
interface VisualDoc {
  version?: number;
  topic?: string;

  state?: Record<string, unknown>;       // canonical mutable values
  derive?: Record<string, string>;       // expressions: "matmul(A,v)", "eigen(A)"
  layout?: Layout;                        // layout tree referencing view ids
  views?: ViewDef[];                      // semantic view definitions
  controls?: Control[];                   // interactive controls bound to state
  relations?: Relation[];                 // semantic links between entities
  presentation?: PresentationState;       // highlights, isolation, annotations

  root?: Visual;                          // backward compat: flat root
}
```

When `VisualDoc` is rendered:

1. `state` is cloned as the canonical state.
2. `derive` expressions are evaluated (topological-like iteration, up to 10 passes) into a `derived` map. State + derived together form the reactive scope.
3. `resolveRefs()` walks the entire document tree (`views`, `layout`, `objects`, `controls`), replacing every `"$name"` string and numeric field with its resolved state/derived value.
4. The layout tree is rendered: string references resolve to view IDs, each view's `objects: Visual[]` are rendered as Visual nodes.
5. `PresentationState` is applied (highlights, isolation dimming, annotation callouts).

---

## 3. The reactive state engine (`state.ts`)

### Expression grammar

Supports function calls, arithmetic, bracket indexing, and dot access:

```
expr    → term (('+' | '-') term)*
term    → factor (('*' | '/') factor)*
factor  → primary ('^' primary)*
primary → number | string | funcall | ref | '(' expr ')'
funcall → ident '(' args ')'
args    → expr (',' expr)*
ref     → '$' ident ('.' ident | '[' expr ']')*
```

### Built-in functions

| Function | Signature | Notes |
|----------|-----------|-------|
| `matmul(A, B)` | `number[][] × number[][]` | Matrix multiplication |
| `eigen(A)` | `number[][] → { values, vectors }` | 2×2 eigenvalues (closed-form) |
| `det(A)` | `number[][] → number` | 2×2 determinant |
| `trace(A)` | `number[][] → number` | Sum of diagonal entries |
| `transpose(A)` | `number[][] → number[][]` | Matrix transpose |
| `sin(x)`, `cos(x)`, `tan(x)` | `number → number` | Trigonometric |
| `sqrt(x)`, `abs(x)`, `exp(x)`, `log(x)` | `number → number` | Math functions |
| `norm(v)` | `number[] → number` | Vector norm |
| `dot(u, v)` | `number[] × number[] → number` | Dot product |
| `identity(n)` | `number → number[][]` | Identity matrix |

### $ref resolution

Any string value starting with `$` is interpreted as an expression:

- `"$A"` → `state.A`
- `"$eig.values"` → `derived.eig.values`
- `"$eig.vectors[0]"` → `derived.eig.vectors[0]`
- `"$A[0][0] + 1"` → `state.A[0][0] + 1`

Resolution is deep: every value in the document tree (including nested objects, arrays, chart series, form defaults, control values) is scanned.

### Example

```json
{
  "state": { "A": [[2, 0], [0, 0.5]], "v": [0.8, 0.6] },
  "derive": { "Av": "matmul(A,v)", "eig": "eigen(A)" },
  "views": [{
    "id": "info",
    "objects": [
      { "kind": "text", "text": "$eig.values[0]" },
      { "kind": "math", "source": "\\lambda = $eig.values[0]" }
    ]
  }]
}
```

The text is rendered as `2` (the first eigenvalue). The math receives `\lambda = 2`.

---

## 4. Layout tree (`layout.ts`)

Independent of the Visual tree. References views by string ID.

```ts
type Layout =
  | { type: 'split'; direction: 'horizontal'|'vertical'; ratio?: number[]; children: (string | Layout)[] }
  | { type: 'stack' | 'row' | 'column'; children: (string | Layout)[] }
  | { type: 'grid'; cols?: number; children: (string | Layout)[] }
  | { type: 'tabs'; tabs: { label: string; content: string | Layout }[] }
  | { type: 'overlay'; base: string | Layout;
      overlays: { id: string; position: 'top-right'|'top-left'|'bottom-right'|'bottom-left'; content: string | Layout }[] }
  | string;  // view id reference
```

### Layout rendering

| Type | Implementation |
|------|---------------|
| `split` | CSS flex with border separators, `flex` ratio |
| `stack` / `row` / `column` | CSS flex, column gets `width:100%`, row gets `flex:1 1 0` |
| `grid` | CSS grid, `grid-template-columns: repeat(cols, 1fr)` |
| `tabs` | Button bar + show/hide content panels, active tab tracking |
| `overlay` | Relative container + absolute-positioned children, `z-index: 10` |
| `string` | Resolves to a view ID, calls renderer with view's `objects` |

### Example: split layout

```json
{
  "layout": {
    "type": "split",
    "direction": "horizontal",
    "ratio": [2, 1],
    "children": ["main_view", "info_panel"]
  },
  "views": [
    { "id": "main_view", "type": "cartesian2d", "objects": [{ "kind": "chart", ... }] },
    { "id": "info_panel", "objects": [{ "kind": "matrix", ... }, { "kind": "math", ... }] }
  ]
}
```

---

## 5. Semantic metadata

```ts
interface Semantic {
  role?: string;          // "eigenvector", "matrix", "transformation"
  concept?: string;       // "direction preserved by transformation"
  represents?: string;    // "first eigenvector of A"
  value?: string;         // "$eig.vectors[0]" (ref, not literal)
  units?: string;
  importance?: 'primary' | 'secondary' | 'detail';
  explanation?: string;   // human-readable tooltip
  related?: string[];     // entity ids
  source?: string;
  category?: string;
}
```

Every `NodeBase` (all Visual kinds, GraphNode, Field, ViewDef) accepts an optional `semantic` field. The renderer:

- Sets `data-semantic-role` attribute on the DOM element
- Sets the HTML `title` attribute to the `explanation` / `concept` / `represents` value
- Marks focusable elements as `tabindex="0"` if `interaction` includes `focus` or `select`

The playground displays focus/semantic info in a floating panel when you click any entity.

---

## 6. View handle API

`render(spec, container)` returns:

```ts
interface View {
  root: HTMLElement;

  // Event subscription
  on(action: string, handler: (payload: unknown) => void): () => void;

  // Element lookup by id
  find(id: string): HTMLElement | null;

  // Flat Visual update (full re-render)
  update(visual: Visual): void;

  // Full document update (re-resolves state, re-renders layout)
  updateDocument(doc: VisualDoc): void;

  // Reactive state
  getState(): Record<string, unknown>;
  setState(path: string, value: unknown): void;

  // Focus / selection
  getFocus(): FocusState;
  setFocus(focus: Partial<FocusState>): void;

  // Cleanup
  unmount(): void;
}
```

`on('*', handler)` subscribes to all action events (wildcard).

`setState("A[0][0]", 3)` writes the value, then re-renders only the nodes that
depend on the changed state key (targeted update). For a `SceneDocument` this
preserves in-progress interactions — e.g. dragging a bound range slider updates
the dependent nodes without tearing down the slider itself. Legacy `VisualDoc`
keeps full re-resolve + re-render (it has a `derive` pass).

---

## 7. Focus & selection

```ts
interface FocusState {
  view?: string;        // active view id
  entity?: string;      // focused entity id
  selection?: string[]; // multi-select
  hover?: string;       // hovered entity
  path?: string[];      // breadcrumb path
}
```

The playground listens for clicks on `[data-exd-id]` elements and calls `view.setFocus({ entity: id })`. This:
- Highlights the element with a blue outline (1.5s animation)
- Updates the floating focus display (top-right of screen)
- Shows the state panel (bottom-right, computed state/derived values)

---

## 8. Presentation state

```ts
interface PresentationState {
  highlights?: string[];       // entity ids to highlight (blue glow)
  isolation?: string[];        // entities to isolate (others dim to 15% opacity)
  annotations?: Annotation[];  // temporary callout labels
}

interface Annotation {
  target: string;              // entity id
  content: string;             // annotation text
  position?: 'top' | 'bottom' | 'left' | 'right';
}
```

Applied after document render. Annotations are absolutely positioned relative to the viewport container. Isolation uses CSS `opacity: 0.15` with transition.

---

## 9. AI mutation contract (types defined)

```ts
type Mutation =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'increment'; path: string; delta?: number }
  | { op: 'reset'; path?: string }
  | { op: 'highlight' | 'emphasize' | 'deemphasize' | 'isolate' | 'select' | 'focus' | 'reveal'; target: string }
  | { op: 'annotate'; target: string; content: string; position?: string }
  | { op: 'show_equation'; target: string; content: string }
  | { op: 'animate'; target: string; animation: string }
  | { op: 'play' } | { op: 'pause' } | { op: 'seek'; time: number }
  | { op: 'add_view'; view: ViewDef }
  | { op: 'remove_view'; id: string }
  | { op: 'add_object' | 'remove_object'; target: string; ... };

interface AIResponse {
  answer?: string;
  mutations?: Mutation[];
}
```

> **Legacy `Mutation`** (above) is deprecated in favor of the unified
> `PatchOp`/`PatchDocument` (§19). The runtime now applies patches via
> `view.applyPatchDocument(patch)` — see §9b below.

---

## 9b. Interaction & mutation runtime (IMPLEMENTED)

The main interactive loop: **select a context → ask a clarifying question →
the AI returns a `PatchDocument` → mutations are applied to the scene.**

```ts
// User selection (runtime, ephemeral — lives in the View, not the document):
//   click = select; shift/ctrl-click = toggle; click-empty = clear.
view.getFocus().selection;              // string[] — user's live selection

// Enriched context for the AI (derived on demand):
const ctx = view.getContext();          // SelectionContext
// { selection, focus?, entities[], relations[], state }

// Apply AI mutations to presentation state (targeted, then re-applied):
view.applyPatchDocument({
  ops: [
    { op: 'highlight', target: 'node_a', params: {} },
    { op: 'annotate', target: 'node_a', params: { text: '…', position: 'below' } },
    { op: 'isolate',  target: 'node_a', params: {} },
  ],
});
```

Implemented ops (of the 10): `isolate`, `dim`, `highlight`, `reveal`, `conceal`,
`annotate`, `camera_focus`, `reset`. `scrub`/`sequence` are deferred (need a
time/step model). `focus`/`select` are **not** PatchOps in the C++ contract —
user selection is `FocusState.selection`; AI-authored selection is
`ScenePresentationState.selection`.

Structured events (subscribe via `view.on(name, handler)` or the `'*'` wildcard):

| Event | Payload |
|-------|---------|
| `selection:change` | `{ selection, focus }` |
| `hover:change` | `{ entity }` |
| `mutations:applied` | `{ patch, presentation }` |

**Local interaction (no AI):** hover-highlight, click/shift-click selection, and
drag are all **gated on `NodeInteraction` flags** (defaults `hover/select/focus/
inspect = true`, `drag/edit = false`). Dragging moves absolutely-positioned
nodes (manual/arranged layouts) and commits the new position to
`transform.position` on mouseup.

---

## 10. Controls (types defined)

```ts
type Control =
  | { type: 'slider'; id: string; bind: string; min?; max?; step? }
  | { type: 'number_input'; id: string; bind: string; ... }
  | { type: 'range_slider' | 'toggle' | 'checkbox' | 'radio' | 'select' }
  | { type: 'button' | 'button_group' }
  | { type: 'matrix_editor'; value?: number[][] }
  | { type: 'play_pause' | 'step_forward' | 'step_backward' | 'scrubber' | 'reset' }
  | { type: 'drag_point' | 'visibility_toggle' | 'tabs' }
```

Controls are bound to state paths via `bind: string`. Control rendering is deferred.

---

## 11. Relations (types defined)

```ts
interface Relation {
  from: string;
  to: string;
  type: 'depends_on' | 'derived_from' | 'transforms' | 'maps_to' | 'contains' |
        'part_of' | 'causes' | 'controls' | 'corresponds_to' | 'scaled_by' |
        'computed_by' | 'flows_to' | 'reads_from' | 'writes_to' | 'related_to' |
        'eigenvector_of' | 'output_of' | 'input_to';
  label?: string;
}
```

Declared at the document root. Used by future context resolution (what entities to include when the user asks about a focused entity). Not yet rendered.

---

## 12. Extensibility

### Custom renderers

```ts
import { registerRenderer } from 'extropian-web-ui';

registerRenderer('mermaid', (props, ctx) => {
  const el = document.createElement('div');
  Mermaid.render(props.code, el);
  return el;
});

// Usage:
const doc = { kind: 'custom', type: 'mermaid', props: { code: 'graph TD; A→B;' } };
```

### Renderer context

```ts
interface RendererContext {
  render(v: Visual): HTMLElement;    // recurse into child nodes
  emit(action: string, payload: unknown): void;  // fire declarative event
  focus(entityId: string, isSelection?: boolean): void;
  getFocus(): FocusState;
  getState(): Record<string, unknown>;
}
```

---

## 13. Dependencies

| Library | Usage | Load strategy |
|---------|-------|--------------|
| `katex` | Math rendering | `import('katex')` on first math node |
| `d3-scale`, `d3-shape`, `d3-axis` | Charts (line, scatter, bar, area, heatmap) | `Promise.all([...])` on first chart |
| `d3-force`, `d3-selection`, `d3-zoom` | Force-directed graph | `Promise.all([...])` on first graph |
| None | Panels, text, matrices, tables, forms, buttons | Native DOM |

All lazy-loaded. CSS for KaTeX is loaded via CDN `<link>` on first math render.

---

## 14. Architecture diagram

```
extropian-web-ui/src/
│
├── types.ts          ← Visual, VisualDoc, Layout, Semantic, Control, Mutation, View
├── state.ts          ← expression parser, $ref resolver, derived evaluator
├── layout.ts         ← Layout → DOM (split, stack, tabs, overlay, grid, row, column)
├── render.ts         ← render(), ViewImpl, action dispatch, focus, state mutations
├── styles.ts         ← dark theme CSS injection
├── index.ts          ← public API exports
│
└── components/
    ├── panel.ts      ← flex/grid container
    ├── text.ts       ← heading/body/code/label
    ├── math.ts       ← KaTeX (lazy)
    ├── chart.ts      ← d3: line/scatter/bar/area/heatmap (lazy)
    ├── matrix.ts     ← HTML table with headers
    ├── table.ts      ← data table
    ├── graph.ts      ← d3-force + SVG connectors (lazy)
    ├── form.ts       ← number/text/complex/select/boolean/range
    ├── button.ts     ← action-emitter
    └── view_ref.ts   ← layout placeholder
```

---

## 15. Playground (extropian-composer-web)

Live at `http://localhost:3000`. Features:

- Left pane: JSON editor with syntax-highlighted textarea
- Right pane: rendered output
- Ctrl+Enter to render
- Preset dropdown: 10 example documents covering all formats and kinds
- Focus display: click any entity to see its id, semantic role, and explanation
- State panel: shows resolved `state` + `derived` values (bottom-right)
- Events counter: counts declarative `action` fires (footer bar)
- Error bar: parse/render errors shown inline below the editor

### Presets

| Preset | Format | Highlights |
|--------|--------|-----------|
| SD · Navier–Stokes | **SceneDocument** | the only preset in the canonical `SceneDocument` shape (spaces/nodes/interaction/style) |
| Eigenvalues (full doc) | VisualDoc | state + derive + split layout + semantic + annotations |
| State + Cartesian2D | VisualDoc | state + derive + row layout + chart showing A·unit_circle |
| Dashboard + Tabs | VisualDoc | tabs layout with equation view + chart view |
| Navier–Stokes (flat) | Visual | math display-mode equations |
| Line Chart (flat) | Visual | d3 line chart with 2 series |
| Scatter Plot (flat) | Visual | d3 scatter with Re vs Cd |
| Heatmap (flat) | Visual | d3 color-scale heatmap |
| Force Graph (flat) | Visual | d3-force draggable nodes |
| Form + Complex Input (flat) | Visual | all field types incl. complex number |
| Correlation Matrix (flat) | Visual | labeled matrix table |

Only "SD · Navier–Stokes" uses the genuine `SceneDocument` format — every
other preset predates it and uses the older flat `Visual`/`VisualDoc`
shapes, which lack `style`/`interaction` entirely. Even the SD preset sets
`interaction` all-false and `style` at defaults (one node uses
`emphasis: 'subtle'`) on every node, so there is currently no preset that
demonstrates AI-driven style/interaction producing visibly different
rendering.

---

## 16. Repository structure

```
~/code/
├── extropian-web-ui/       # Library — npm package
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/                # (as shown in §14)
│
└── extropian-composer-web/ # App — playground consumer
    ├── package.json        # depends on extropian-web-ui via path alias
    ├── vite.config.ts      # alias → ../extropian-web-ui/src/index.ts
    ├── index.html
    └── src/
        ├── main.ts
        ├── playground.ts
        └── presets/index.ts
```

Deprecated GL/WASM files (`src/gl/`, `src/wasm/`, `wasm/`) remain in the repo but are not imported by the new entry.

---

## 17. Current status & next steps

### Implemented
- Full Visual contract (11 kinds)
- Full VisualDoc contract (state, derive, layout, views, semantics)
- Reactive state engine (expression parser, $ref resolution, derived evaluation)
- Layout tree renderer (split, stack, tabs, overlay, row, column, grid)
- Semantic metadata rendering (data attributes, tooltips)
- Focus/selection tracking + UI
- Presentation state (highlights, isolation, annotations)
- Playground with focus inspection and state display
- 10 presets covering both formats
- Table-driven 2D/3D document model (`SPACE_DIMENSIONS`, `NODE_DIMENSIONS`) with
  render-time placement validation and `is2DSceneDocument()` (see §18)
- SceneDocument reactivity: `$ref` resolution against `state` at render time,
  and `setState()` re-renders the scene tree (see §19)
- DataBinding: `SceneNode.data.bind` (+ `path`) injects a bound value into the
  node's primary content field; bound form fields read/write `state` two-way
  (see §19)
- Interaction: hover-highlight (node + neighbors + edges), click/shift-click
  selection, `getContext()`, and `applyPatchDocument()` (AI mutation runtime)
  — see §9b

### Types defined, rendering deferred
- 20 control types (sliders, matrix_editor, play_pause, etc.)
- 17 relation types
- `scrub`/`sequence` patch ops (need a time/step model)
- AIResponse envelope

### Deferred to the 3D renderer
- 3D-only node types (`Mesh`, `Volume`, `Viewport`) and 3D spaces
  (`viewport3d`, `world3d`) render as placeholders until the 3D backend lands.
  The 2D/3D split (orthographic = 2D, perspective = 3D) is the seam where that
  backend attaches.


## 18. 2D vs 3D document model

One `SceneDocument` covers both a web-native 2D UI and a 3D scene graph.
Dimensionality is **table-driven** — no extra schema fields. A node's
dimension comes from its `type`; a space's comes from its `type` +
`projection`.

### The switch: space projection

`Space.projection` selects the rendering backend:

| projection | Meaning | Web backend |
|------------|---------|-------------|
| `orthographic` | Fixed 2D canvas — no camera | Native DOM/CSS + d3 SVG ✅ |
| `perspective` | Camera-based 3D view | Placeholder until the 3D renderer lands ⏳ |

**Web-first policy:** orthographic 2D spaces are the primary web path; 3D
spaces render as placeholders until 3D components are added.

### Space dimensionality

| SpaceType | Dimension | Camera |
|-----------|-----------|--------|
| `screen` | 2D | unused |
| `panel` | 2D | unused |
| `cartesian2d` | 2D | unused |
| `overlay` | 2D | unused |
| `viewport3d` | 3D | required |
| `world3d` | 3D | required |

### Node dimensionality

| Dimension | NodeTypes | Notes |
|-----------|-----------|-------|
| `2d` | `Panel`, `Text`, `Code`, `Equation`, `Matrix`, `Plot`, `Table`, `Form`, `Button`, `Image` | Web-native UI/UX + d3 SVG |
| `both` | `Label`, `Vector`, `Curve`, `Graph`, `Group` | Same concept, per-backend geometry (`Label` = billboard text in 3D) |
| `3d` | `Mesh`, `Volume`, `Viewport` | 3D-only; placeholder in the web backend |

The tables live in `src/types.ts` as the `SPACE_DIMENSIONS` and
`NODE_DIMENSIONS` constants — the single source of truth for both the
runtime and this document.

### Placement rules

Validated at render time (`renderSceneNode` + the space loop):

| Node | Space | Behavior |
|------|-------|----------|
| 2D / both | 2D | Native DOM/SVG render ✅ |
| 3D | 2D | Node placeholder + `console.warn` ⏳ |
| any | 3D | Whole-space placeholder + `console.warn` (nodes are not individually rendered; billboarded 2D-in-3D is a future path) ⏳ |

`is2DSceneDocument(doc)` returns `true` when every space is 2D (orthographic,
no camera) and no 3D node is present, so consumers can assert the "entirely 2D, no camera" web path.

---

## 19. Unified SceneDocument TypeScript Interface (IMPLEMENTED — v0.3)

> **Authoritative type definition:** C++ structs in `extropian-core/include/exd/types/`
> (`scene_document.hpp`, `presentation_state.hpp`) — the `compiler-plan.md` §12 is the
> documented copy of that spec.
> **Canonical headers:** `extropian-core/include/exd/types/` (created).
> **This file:** TypeScript mirror consuming the same JSON format.
> **When to update:** Whenever the C++ structs change, update `src/types.ts` to keep the mirror aligned.

### Naming convention note

The C++ types use bare names (`Relation`, `Annotation`, `PresentationState`,
etc.).  Our TypeScript mirror prefixes them with `Scene` (`SceneRelation`,
`SceneAnnotation`, `ScenePresentationState`) to avoid collisions with legacy
`@deprecated` types that share the same names.  JSON wire format is
unaffected — only TypeScript type names differ.

### SpaceType serialization convention

The C++ `enum class SpaceType` has PascalCase values (`Screen`, `Panel`,
`Cartesian2D`, `Viewport3D`, `World3D`, `Overlay`); our TS mirror uses
lowercase strings (`'screen'`, `'panel'`, …) as the JSON wire convention.
The C++ `NodeType` enum uses PascalCase strings in both.

> **Note on the mirror relationship:** `src/types.ts` is a hand-kept mirror
> of the C++ structs in `extropian-core/include/exd/types/`. There is no
> shared-fixture test harness between the two backends — the TypeScript side
> evolves independently and stays aligned by review.

---

### Implemented TypeScript types (mirror of C++ §12.4–§12.6)

```typescript
// ── Space types ──

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
    arrangement?: DiagramLayout;   // how children are laid out (2D diagrams)
}

// ── Node types ──

export type NodeType =
    | 'Panel' | 'Text' | 'Equation' | 'Matrix' | 'Plot'
    | 'Vector' | 'Curve' | 'Mesh' | 'Volume' | 'Label'
    | 'Graph' | 'Code' | 'Image' | 'Viewport' | 'Group'
    | 'Table' | 'Form' | 'Button' | 'Shape' | 'Legend';

export interface Transform {
    position: [number, number, number];
    rotation: [number, number, number, number];  // quaternion [x,y,z,w]
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
    concept_id: string;    // renamed from 'concept' — matches C++ (C++20 keyword conflict)
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
```

> **Implementation status (`NodeInteraction`):** these 6 booleans are the
> correct schema mirror of the C++ struct, but only half of them are wired
> to any behavior. `render.ts#applySceneNodeAttrs()` reads `select`,
> `focus`, and `inspect` — and only to set `cursor: pointer` + `tabIndex = 0`
> on the element. `hover`, `drag`, and `edit` are not consulted anywhere
> else in the codebase. `interactionToLegacy()` flattens all 6 into a
> `data-interaction` string array that nothing downstream reads. The only
> node types with genuinely interactive DOM behavior are `Button`
> (`button.ts`, real click handler) and `Graph` (`graph.ts`, real d3-force
> drag) — and neither of those actually gates on `node.interaction`; the
> behavior is unconditional. Every other node type (Panel, Text, Equation,
> Matrix, Table, Image, Label, and the 3D placeholders) has no interaction
> wiring at all.
>
> **`NodeStyle.depth`** is defined here to mirror the C++ struct but is
> never read anywhere in this codebase — it is currently a dead field.

```typescript
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
    encode?: Encoding;            // visual encoding: metric → channel
    ports?: Port[];               // connection points for edge routing
    interaction: NodeInteraction;
    style: NodeStyle;
    children: SceneNode[];
}

// ── Relations ──

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

// ── Presentation state ──

export interface CameraOverride {
    space: string;
    pose?: CameraPose;
}

export interface StyleOverride {
    emphasis: 'subtle' | 'default' | 'primary' | 'prominent';  // canonical vocabulary (see note below)
    opacity: number;
}

> **Emphasis vocabulary (unified):** `subtle | default | primary | prominent`
> is the single canonical emphasis scale across `NodeStyle.emphasis` and
> `StyleOverride.emphasis` (C++ `scene_document.hpp` + `presentation_state.hpp`
> use the same strings). Runtime overrides default to `subtle` (dim), usually
> paired with low `opacity`.

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

// ── Patch ops (AI mutation contract) ──

export interface PatchOp {
    op: 'isolate' | 'camera_focus' | 'annotate' | 'dim' | 'highlight' | 'reveal' | 'conceal' | 'scrub' | 'sequence' | 'reset';
    target: string;
    params: Record<string, unknown>;
}

export interface PatchDocument {
    ops: PatchOp[];
}

// ── Top-level SceneDocument ──

export interface SceneDocument {
    version: number;
    topic: string;
    spaces: Space[];
    nodes: SceneNode[];
    relations: SceneRelation[];
    presentation?: ScenePresentationState;
    state: Record<string, unknown>;
    data_sources: Record<string, unknown>;
    scales?: ScaleDef[];          // shared visual scales (metric → channel)
}
```

### Diagram primitives — shapes, ports, encoding, layout (v1.1)

The diagram vocabulary for building interactive 2D diagrams (architecture,
dataflow, neural networks, codebase maps, …). These are the new contract
primitives layered on top of the existing node/relation model:

```typescript
export type ShapeType =
    | 'Rect' | 'RoundedRect' | 'Circle' | 'Ellipse' | 'Diamond'
    | 'Hexagon' | 'Parallelogram' | 'Triangle' | 'Pill' | 'Cylinder'
    | 'Stack' | 'Grid' | 'Strip' | 'Document';

export interface Port {
    id: string;
    side: 'north' | 'east' | 'south' | 'west';
    position: number;            // 0..1 along the side (0 = left/top)
}

export type ScaleType = 'linear' | 'log' | 'sqrt' | 'threshold' | 'quantize' | 'ordinal';

export interface ScaleDef {
    id: string;
    type: ScaleType;
    scheme: string;              // viridis | magma | inferno | plasma | blues | diverging | category10 | category20
    domain: unknown;             // [min,max] or [category,...]
    range: unknown;              // [min,max] (size) or [color,...]
}

export interface ChannelSpec {
    source: string;              // data path, e.g. "metrics.code_size"
    scale?: string;              // id of a ScaleDef in SceneDocument.scales
}

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

export interface DiagramLayout {
    algorithm: LayoutAlgorithm;
    size_by?: ChannelSpec;       // treemap/pack: channel driving area
    color_by?: ChannelSpec;
    lane_by?: ChannelSpec;       // swimlane: channel grouping nodes into lanes
    time_by?: ChannelSpec;       // timeline: channel positioning nodes on the time axis
    start_by?: ChannelSpec;      // timeline (gantt): channel for bar start
    end_by?: ChannelSpec;        // timeline (gantt): channel for bar end
    params: Record<string, unknown>;   // orientation, rankdir, gap, ...
}
```

Semantics:

- `SceneNode.type = 'Shape'` renders a geometric primitive; `geometry.shape`
  picks the `ShapeType` (see table below).
- `SceneNode.encode` binds metrics to visual channels through shared
  `scales[]` — e.g. "code size → box area, complexity → color" — so a single
  scale gives one consistent meaning + legend across the whole document.
- `SceneNode.ports` + `SceneRelation.source_port`/`target_port` anchor edges to
  node sides instead of centers (elbow/bezier/tube/line routing).
- `SceneRelation.bundle` marks a relation as representing N logical edges —
  rendered thicker with a `×N` label (e.g. a warp's 32 lanes).
- `Space.arrangement` positions child nodes. All ten algorithms are implemented:
  `manual`, `grid`, `layered` (Sugiyama ranks + barycenter), `tree`, `radial`,
  `force` (d3-force, sync ticks), `treemap` (squarified), `pack` (d3 circle
  packing), `swimlane` (`lane_by`), and `timeline` (point-in-time `time_by`, or
  gantt bars with `start_by`/`end_by`). `tree`/`radial` flatten nested
  `children` into absolutely-positioned nodes; the rest lay out the space's
  top-level nodes.
- `SceneNode.arrangement` turns any node into a **container**: its children are
  laid out *inside* the node's bounds (using the same `DiagramLayout`) and
  absolutely positioned. Recursive — a container's children may themselves be
  containers, so a module can nest submodules with different layouts per level
  (e.g. a grid of modules, each packing its own files). The container's size
  comes from `geometry.width`/`height` or the box assigned by its parent layout.
- **Hover interaction**: hovering a node highlights it, its neighbors, and its
  incident edges (via `data-exd-hovered`).

### Node Type Geometry & Content by Type

Each `SceneNode.type` has specific fields in `geometry` and `content`:

| NodeType | `geometry` fields | `content` fields |
|----------|------------------|-----------------|
| `Panel` | `width`, `height`, `minWidth`, `maxWidth`, `cornerRadius`, `background`, `border`, `shadow`, `scroll` | `title`, `collapsible`, `collapsed` |
| `Text` | `maxWidth`, `lineHeight` | `text`, `variant` (heading/body/code/caption/label), `level`, `syntax` |
| `Equation` | `display`, `block` | `source` (LaTeX), `label` |
| `Matrix` | `rows`, `cols`, `cellWidth`, `cellHeight`, `showRowLabels`, `showColLabels`, `rowLabels`, `colLabels` | `value` (number[][]), `editable`, `step` |
| `Plot` | `chartType` (line/scatter/bar/area/heatmap), `width`, `height`, `xAxis`, `yAxis`, `grid`, `legend` | `series[]` ({name, data, color, lineWidth, marker}) |
| `Vector` | `origin`, `direction`, `length`, `arrowSize`, `shaftRadius`, `color` | `label`, `labelPosition` |
| `Curve` | `tRange`, `samples`, `lineWidth`, `color`, `tube` | `parametric` ({x, y, z}) or `points` |
| `Mesh` | `shape` (sphere/box/cylinder/torus/capsule/cone/plane/custom), `params`, `wireframe`, `opacity` | `label` |
| `Volume` | `kind` (isosurface/slice/streamlines/pointcloud/glyphs), `resolution`, `domain` | `field`, `isosurface`, `colormap` |
| `Label` | `fontSize`, `color`, `background`, `maxWidth` | `text`, `alignment` |
| `Graph` | `layout` (force-directed/tree/radial/layered/flow), `layoutParams`, `nodeRadius`, `edgeStyle` | `nodes[]`, `edges[]` |
| `Code` | `lineNumbers`, `maxHeight`, `fontSize` | `source`, `language`, `highlightLines` |
| `Image` | `width`, `height`, `fit` (contain/cover/fill), `cornerRadius` | `src`, `alt`, `caption` |
| `Viewport` | `width`, `height`, `border` | `controls` (boolean) |
| `Group` | (none) | `name` |
| `Table` | `sortable`, `filterable`, `striped`, `maxHeight` | `columns[]`, `rows[]` |
| `Form` | `layout`, `gap` | `fields[]` ({id, label, type, value, min, max, step, bind}) |
| `Button` | `variant` (primary/secondary/danger/ghost), `size`, `icon` | `label`, `action` |
| `Shape` | `shape` (ShapeType), `width`, `height`, `cornerRadius`, `fill`, `stroke`, `strokeWidth`, `rows`/`cols` (Grid), `count` (Stack/Strip) | `label`, `labelPosition` |
| `Legend` | (none) | `scale` (ScaleDef id), `title` |

### Renderer Mapping (SceneNode.type → Component) — ALL IMPLEMENTED

When `render(sceneDocument)` is called, the engine walks the node tree and
dispatches to registered renderers:

| NodeType | Renderer | Status |
|----------|----------|--------|
| `Panel` | `panel.ts` (via adapter) | ✅ |
| `Text` | `text.ts` (via adapter) | ✅ |
| `Equation` | `math.ts` (via adapter) | ✅ |
| `Matrix` | `matrix.ts` (via adapter) | ✅ |
| `Plot` | `chart.ts` (via adapter) | ✅ |
| `Graph` | `graph.ts` (via adapter) | ✅ |
| `Table` | `table.ts` (via adapter) | ✅ |
| `Form` | `form.ts` (via adapter) | ✅ |
| `Button` | `button.ts` (via adapter) | ✅ |
| `Shape` | `components/shape.ts` (SVG geometry) | ✅ |
| `Legend` | `components/legend.ts` (scale ramp/swatches/sizes) | ✅ |
| `Code` | `text.ts` (code variant) | ✅ |
| `Image` | `components/image.ts` | ✅ |
| `Label` | `text.ts` (label variant) | ✅ |
| `Group` | Pass-through wrapper | ✅ |
| `Vector` | `components/geometry2d.ts` (2D SVG arrow) | ✅ |
| `Curve` | `components/geometry2d.ts` (2D SVG polyline) | ✅ |
| `Mesh` | Placeholder — deferred to v0.2 WASM | ⏳ |
| `Volume` | Placeholder — deferred to v0.2 WASM | ⏳ |
| `Viewport` | Placeholder — deferred to v0.2 WASM | ⏳ |

"ALL IMPLEMENTED" above refers strictly to content/geometry dispatch — each
`NodeType` reaches a real component renderer. It does **not** mean
`node.interaction` drives behavior; see the implementation-status note under
`NodeInteraction` above for what is and isn't wired.

### New Modules Added (v0.3)

| Module | Purpose |
|--------|---------|
| `src/spaceResolver.ts` | Maps `node.space` to CSS coordinate transforms. Handles screen/panel/overlay space types, groups nodes by space, creates positioned DOM containers. |
| `src/billboardHandler.ts` | Handles `node.orient.mode` (fixed/billboard/billboard_y). Stub for 2D DOM; ready for v0.2 WASM 3D. |
| `src/presentationEngine.ts` | Applies `ScenePresentationState`: focus glow, style overrides (emphasis + opacity), annotations (callout/tooltip/label at all 5 positions), animation clips (pulse/highlight/fade_in/fade_out/slide_in/scale_up). |
| `src/convertVisualDocToSceneDocument.ts` | Backward compat: legacy `VisualDoc` → unified `SceneDocument`. Handles all 11 Visual kinds, views, relations, and presentation state. |
| `src/components/image.ts` | Image renderer for `SceneNode{type: 'Image'}`. Handles src, alt, caption, width/height, fit, cornerRadius. |

### Legacy Migration Completed (v0.3)

All old types in `src/types.ts` are marked `@deprecated` and retained for
backward compatibility:

- ✅ `Visual` discriminated union — marked `@deprecated`
- ✅ `VisualDoc` interface — marked `@deprecated`
- ✅ `ViewDef` interface — marked `@deprecated`
- ✅ `Control` types (20 types) — marked `@deprecated`; concept lives in `SceneNode{type: "Form"}.content.fields[]`
- ✅ `Layout` tree type — marked `@deprecated`; replaced by `SceneNode.layout.strategy`
- ✅ `NodeBase` concept — retained, marked `@deprecated`; renamed to `SceneNode` in the unified schema
- ✅ `Semantic` interface — retained, marked `@deprecated`; renamed to `NodeSemantic`
- ✅ `PresentationState` — retained, marked `@deprecated`; new fields (camera, animations) in `ScenePresentationState`
- ✅ `FocusState` — kept as-is (used by both old and new paths)
- ✅ `Mutation` and `AIResponse` — marked `@deprecated`; replaced by `PatchOp[]` / `PatchDocument`
- ✅ `RendererContext` and `RendererFn` — kept as-is (used by both paths)

### Public API Additions (v0.3)

```typescript
// New exports from src/index.ts:
export { render, registerRenderer, isSceneDocument, renderSceneNode } from './render.js';
export { resolveSpaces, createSpaceContainer, groupNodesBySpace, getSpaceForNode } from './spaceResolver.js';
export { applyBillboard, billboardCssClass, billboardTransform } from './billboardHandler.js';
export { applyPresentationState, clearPresentationState } from './presentationEngine.js';
export { convertVisualDocToSceneDocument } from './convertVisualDocToSceneDocument.js';

// Render input now accepts SceneDocument:
export type RenderInput = Visual | VisualDoc | SceneDocument;
```
