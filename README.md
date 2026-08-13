# extropian-web-ui

**TypeScript library:** render a unified `SceneDocument` (JSON) to interactive DOM —
KaTeX for math, d3 for charts and force graphs, native DOM for panels, tables, and forms.

## Role

The web rendering backend for Composer. Consumes the same `SceneDocument` format as the
C++ side: the C++ structs in `extropian-core/include/exd/types/` are the authority, and
`src/types.ts` is the hand-kept mirror. Zero framework, zero dependency on the C++ ecosystem.

## Contents

- `src/types.ts` — `SceneDocument` types (mirror of the C++ structs)
- `src/render.ts` — `render()`, node dispatch, view handle
- `src/components/` — panel, text, math, chart, matrix, table, graph, form, button, image
- `src/spaceResolver.ts`, `src/presentationEngine.ts`, `src/billboardHandler.ts`
- `src/convertVisualDocToSceneDocument.ts` — legacy `VisualDoc` → `SceneDocument` migration
- `docs/CONTRACT.md`, `docs/PIPELINE.md`

## Dependencies

`katex`, `d3-force`, `d3-scale`, `d3-shape`, `d3-axis`, `d3-selection`, `d3-zoom`
(all lazy-loaded on first use).

## Build

```bash
npm install
npm run build
```

## Usage

```ts
import { render } from 'extropian-web-ui';

const view = render(sceneDocument, document.body);
```

See `docs/PIPELINE.md` for the full render pipeline and `docs/CONTRACT.md` for the API.
