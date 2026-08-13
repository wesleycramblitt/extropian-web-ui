// Inject minimal base styles — dark theme defaults.
const CSS = `
  .exd-panel {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: #e0e0e0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    box-sizing: border-box;
  }
  .exd-panel-title {
    font-size: 15px;
    font-weight: 600;
    color: #a0a0c0;
    border-bottom: 1px solid #2a2a4a;
    padding-bottom: 8px;
    margin-bottom: 4px;
  }
  .exd-panel-row { flex-direction: row; flex-wrap: wrap; }
  .exd-panel-column { flex-direction: column; }
  .exd-panel-grid {
    display: grid;
    gap: 12px;
  }

  .exd-text-heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0; }
  .exd-text-body { font-size: 14px; font-weight: 400; color: #d0d0d0; line-height: 1.6; }
  .exd-text-code { font-size: 13px; font-family: 'JetBrains Mono', monospace; background: #0e0e1a; padding: 12px; border-radius: 6px; white-space: pre-wrap; color: #b0d0b0; overflow-x: auto; }
  .exd-text-label { font-size: 12px; font-weight: 500; color: #a0a0c0; text-transform: uppercase; letter-spacing: 0.5px; }

  .exd-math-block {
    background: #16213e;
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 16px;
    line-height: 1.5;
    color: #e8e8f0;
  }
  .exd-math-block .katex { font-size: 1.1em; }
  .exd-math-block .katex-display { margin: 4px 0; }

  .exd-chart { width: 100%; min-height: 200px; overflow: visible; }
  .exd-chart svg { width: 100%; height: 100%; }

  .exd-matrix { overflow-x: auto; }
  .exd-matrix table { border-collapse: collapse; margin: 0; }
  .exd-matrix td, .exd-matrix th {
    padding: 6px 10px; border: 1px solid #2a2a4a; text-align: center;
    font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #e0e0e0;
  }
  .exd-matrix th { background: #0e0e2a; color: #8080b0; font-weight: 500; }
  .exd-matrix td { background: #1a1a2e; }

  .exd-table { width: 100%; overflow-x: auto; }
  .exd-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .exd-table th { background: #16213e; color: #8080b0; font-weight: 600; padding: 8px 12px; text-align: left; border-bottom: 2px solid #2a2a4a; }
  .exd-table td { padding: 6px 12px; border-bottom: 1px solid #1a1a3e; color: #d0d0d0; }
  .exd-table tr:hover td { background: #1e1e3a; }

  .exd-graph { width: 100%; min-height: 300px; overflow: hidden; }
  .exd-graph svg { width: 100%; height: 100%; }
  .exd-graph-node { cursor: grab; }
  .exd-graph-node:active { cursor: grabbing; }
  .exd-graph-node circle { fill: #4a9eff; stroke: #1a1a2e; stroke-width: 2; }
  .exd-graph-node text { fill: #e0e0e0; font-size: 11px; font-family: 'Inter', sans-serif; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  .exd-graph-edge { stroke: #3a3a6a; stroke-width: 1.5; fill: none; }

  .exd-shape { box-sizing: border-box; overflow: visible; }
  .exd-shape svg { display: block; width: 100%; height: 100%; }

  .exd-legend { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 6px; max-width: 240px; box-sizing: border-box; }
  .exd-legend-title { font-size: 12px; font-weight: 600; color: #a0a0c0; }
  .exd-legend-missing { font-size: 11px; color: #8080b0; font-family: 'JetBrains Mono', monospace; }
  .exd-legend-ramp { height: 10px; border-radius: 3px; width: 100%; }
  .exd-legend-ramp-labels { display: flex; justify-content: space-between; font-size: 10px; color: #8080b0; }
  .exd-legend-swatches { display: flex; flex-direction: column; gap: 3px; }
  .exd-legend-swatch { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #d0d0d0; }
  .exd-legend-swatch-color { width: 12px; height: 12px; border-radius: 2px; display: inline-block; flex-shrink: 0; }
  .exd-legend-sizes { display: flex; align-items: flex-end; gap: 10px; padding: 6px 0; }
  .exd-legend-size-item { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: #8080b0; }
  .exd-legend-size-circle { display: inline-block; border-radius: 50%; background: #4a9eff; }

  /* Hover-highlight: the hovered node, its neighbors, and incident edges. */
  [data-exd-hovered] { outline: 1px solid #4a9eff; outline-offset: 1px; }
  svg path[data-exd-hovered] { stroke: #4a9eff; stroke-width: 2.5; }

  .exd-form { display: flex; flex-direction: column; gap: 10px; }
  .exd-form-field { display: flex; flex-direction: column; gap: 4px; }
  .exd-form-field-row { display: flex; align-items: center; gap: 8px; }
  .exd-form-label { font-size: 12px; font-weight: 500; color: #a0a0c0; }
  .exd-form-input { background: #0e0e2a; border: 1px solid #2a2a4a; border-radius: 4px; padding: 6px 10px; color: #e0e0e0; font-size: 13px; font-family: 'JetBrains Mono', monospace; box-sizing: border-box; }
  .exd-form-input:focus { outline: none; border-color: #4a9eff; }
  .exd-form-select { background: #0e0e2a; border: 1px solid #2a2a4a; border-radius: 4px; padding: 6px 8px; color: #e0e0e0; font-size: 13px; }
  .exd-form-checkbox { display: flex; align-items: center; gap: 6px; }
  .exd-form-checkbox input { accent-color: #4a9eff; }
  .exd-form-range { width: 100%; accent-color: #4a9eff; }

  .exd-button {
    display: inline-block;
    padding: 8px 16px;
    background: #2a2a5a;
    color: #e0e0e0;
    border: 1px solid #3a3a6a;
    border-radius: 6px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
  }
  .exd-button:hover { background: #3a3a6a; }
  .exd-button:active { background: #4a4a7a; }

  .exd-error {
    background: #2a1010;
    border: 1px solid #5a2020;
    color: #ff8888;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    white-space: pre-wrap;
  }

  .exd-layout-flex, .exd-layout-split, .exd-layout-grid, .exd-layout-tabs, .exd-layout-overlay {
    width: 100%;
  }

  .exd-tab-btn:hover { color: #c0c0e0 !important; }

  .exd-tab-content > * { display: block; }

  .exd-layout-overlay-item {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 6px;
    padding: 8px;
    backdrop-filter: blur(8px);
  }

  .exd-annotation {
    animation: exd-annotate-in 0.2s ease-out;
  }

  @keyframes exd-annotate-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  [data-exd-selected] {
    transition: outline 0.3s;
  }

  /* ── Space containers ──────────────────────────────────────────────────── */

  .exd-screen {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #e0e0e0;
  }

  .exd-space {
    box-sizing: border-box;
  }

  .exd-space-overlay {
    backdrop-filter: blur(8px);
    pointer-events: none;
  }
  .exd-space-overlay > * {
    pointer-events: auto;
  }

  /* ── Group (pass-through container) ─────────────────────────────────────── */

  .exd-group {
    display: contents;
  }

  /* ── Image ──────────────────────────────────────────────────────────────── */

  .exd-image-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 6px;
    overflow: hidden;
  }
  .exd-image {
    display: block;
    max-width: 100%;
  }
  .exd-image-caption {
    font-family: 'Inter', sans-serif;
  }

  /* ── Placeholder (3D types, v0.2) ───────────────────────────────────────── */

  .exd-placeholder {
    user-select: none;
  }

  /* ── Billboard orientation classes ──────────────────────────────────────── */

  .exd-orient-fixed {
    /* No-op in 2D — entity keeps its layout position */
  }
  .exd-orient-billboard {
    /* No-op in 2D — always faces viewer */
  }
  .exd-orient-billboard-y {
    /* No-op in 2D */
  }

  /* ── Annotation styles ──────────────────────────────────────────────────── */

  .exd-annotation-callout {
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    font-weight: 500;
  }
  .exd-annotation-tooltip {
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    max-width: 220px;
    white-space: normal;
  }
  .exd-annotation-label {
    border: 1px dashed #4a9eff;
    background: transparent;
  }
`;

// Only inject once
let injected = false;
export function injectBaseStyles(): void {
  if (injected) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  injected = true;
}
