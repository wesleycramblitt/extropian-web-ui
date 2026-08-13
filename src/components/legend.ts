// Legend renderer — SceneNode{type:'Legend'} displays a named visual scale
// (from SceneDocument.scales) as a color ramp, swatches, or size legend.
import type { SceneNode, RendererContext, ScaleDef } from '../types.js';
import { SCHEMES } from '../scale.js';

function colorStops(def: ScaleDef): string[] {
  if (Array.isArray(def.range) && def.range.length >= 2 && typeof def.range[0] === 'string') {
    return def.range as string[];
  }
  if (def.scheme && SCHEMES[def.scheme]) return SCHEMES[def.scheme];
  return SCHEMES.category10;
}

function domainValues(def: ScaleDef): unknown[] {
  return Array.isArray(def.domain) ? def.domain : [];
}

function isNumericRange(def: ScaleDef): boolean {
  return Array.isArray(def.range) && def.range.length >= 2 && typeof def.range[0] === 'number';
}

export function renderLegend(node: SceneNode, ctx: RendererContext): HTMLElement {
  const c = node.content as Record<string, unknown>;
  const scaleId = typeof c.scale === 'string' ? c.scale : '';
  const title = typeof c.title === 'string' ? c.title : scaleId;
  const def = scaleId ? ctx.getScales().get(scaleId) : undefined;

  const el = document.createElement('div');
  el.className = 'exd-legend';

  if (title) {
    const t = document.createElement('div');
    t.className = 'exd-legend-title';
    t.textContent = title;
    el.appendChild(t);
  }

  if (!def) {
    const err = document.createElement('div');
    err.className = 'exd-legend-missing';
    err.textContent = `[legend: unknown scale "${scaleId}"]`;
    el.appendChild(err);
    return el;
  }

  if (def.type === 'ordinal' || def.type === 'threshold') {
    renderSwatches(el, def);
  } else if (isNumericRange(def)) {
    renderSizeLegend(el, def);
  } else {
    renderRamp(el, def);
  }
  return el;
}

function swatchRow(label: string, color: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'exd-legend-swatch';
  const sw = document.createElement('span');
  sw.className = 'exd-legend-swatch-color';
  sw.style.background = color;
  const lb = document.createElement('span');
  lb.textContent = label;
  row.appendChild(sw);
  row.appendChild(lb);
  return row;
}

function renderSwatches(el: HTMLElement, def: ScaleDef): void {
  const stops = colorStops(def);
  const values = domainValues(def);
  const list = document.createElement('div');
  list.className = 'exd-legend-swatches';
  if (def.type === 'ordinal') {
    values.forEach((v, i) => list.appendChild(swatchRow(String(v), stops[i % stops.length])));
  } else {
    // threshold: one swatch per threshold + a final "≥ last" swatch
    values.forEach((v, i) => list.appendChild(swatchRow(String(v), stops[i % stops.length])));
    const last = values[values.length - 1];
    list.appendChild(swatchRow(`≥ ${last ?? ''}`, stops[stops.length - 1]));
  }
  el.appendChild(list);
}

function renderRamp(el: HTMLElement, def: ScaleDef): void {
  const stops = colorStops(def);
  const bar = document.createElement('div');
  bar.className = 'exd-legend-ramp';
  bar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
  el.appendChild(bar);

  const labels = document.createElement('div');
  labels.className = 'exd-legend-ramp-labels';
  const d = domainValues(def);
  const minL = document.createElement('span');
  minL.textContent = d[0] !== undefined ? String(d[0]) : 'min';
  const maxL = document.createElement('span');
  maxL.textContent = d[1] !== undefined ? String(d[1]) : 'max';
  labels.appendChild(minL);
  labels.appendChild(maxL);
  el.appendChild(labels);
}

function renderSizeLegend(el: HTMLElement, def: ScaleDef): void {
  const d = domainValues(def);
  const r = def.range as number[];
  const minD = r[0];
  const maxD = r[r.length - 1];
  const row = document.createElement('div');
  row.className = 'exd-legend-sizes';
  const mk = (diam: number, label: string): HTMLElement => {
    const item = document.createElement('div');
    item.className = 'exd-legend-size-item';
    const circle = document.createElement('span');
    circle.className = 'exd-legend-size-circle';
    circle.style.width = `${diam}px`;
    circle.style.height = `${diam}px`;
    const lb = document.createElement('span');
    lb.textContent = label;
    item.appendChild(circle);
    item.appendChild(lb);
    return item;
  };
  row.appendChild(mk(minD, d[0] !== undefined ? String(d[0]) : 'min'));
  row.appendChild(mk((minD + maxD) / 2, ''));
  row.appendChild(mk(maxD, d[d.length - 1] !== undefined ? String(d[d.length - 1]) : 'max'));
  el.appendChild(row);
}
