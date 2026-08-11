import type { RendererContext } from '../types.js';
import type { Chart } from '../types.js';

export function renderChart(spec: Chart, _ctx: RendererContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'exd-chart';

  // Placeholder that lazily loads d3 on first render
  renderPlaceholder(container, spec);
  loadD3Chart(container, spec);

  return container;
}

function renderPlaceholder(el: HTMLElement, spec: Chart): void {
  const div = document.createElement('div');
  div.className = 'exd-math-block'; // reuse block bg style
  div.style.textAlign = 'center';
  div.style.padding = '40px 16px';
  div.innerHTML = `<div style="font-size:32px;margin-bottom:8px;">${iconFor(spec.type)}</div>
    <div style="color:#8080b0;font-size:13px;">${spec.title ?? spec.type} chart</div>
    <div style="color:#505070;font-size:11px;margin-top:4px;">Loading...</div>`;
  el.appendChild(div);
}

function iconFor(t: Chart['type']): string {
  switch (t) {
    case 'line': return '\u{1F4C8}'; // chart with upward trend
    case 'scatter': return '\u{25CF}\u{25CF}\u{25CF}';
    case 'bar': return '\u{1F4CA}';
    case 'area': return '\u{1F30A}';
    case 'heatmap': return '\u{1F3F4}\u{200D}\u{2620}\u{FE0F}';
  }
}

// ── d3 lazy load + render ───────────────────────────────────────────────────

let d3: any = null;
let loading = false;

async function loadD3(): Promise<any> {
  if (d3) return d3;
  if (loading) {
    return new Promise(resolve => {
      const check = setInterval(() => { if (d3) { clearInterval(check); resolve(d3); } }, 50);
    });
  }
  loading = true;
  try {
    const [scale, shape, axis, selection] = await Promise.all([
      import('d3-scale'),
      import('d3-shape'),
      import('d3-axis'),
      import('d3-selection'),
    ]);
    d3 = { scale, shape, axis, selection };
  } catch (e) {
    console.warn('[chart] d3 unavailable');
    d3 = null;
  }
  loading = false;
  return d3;
}

async function loadD3Chart(container: HTMLElement, spec: Chart): Promise<void> {
  const lib = await loadD3();
  if (!lib) return;

  // Replace placeholder
  container.innerHTML = '';
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('viewBox', `0 0 600 300`);
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgEl.style.width = '100%';
  svgEl.style.height = '300px';
  container.appendChild(svgEl);

  if (spec.type === 'heatmap') {
    renderHeatmap(svgEl, spec, lib);
  } else {
    renderXYChart(svgEl, spec, lib);
  }
}

function renderXYChart(svg: SVGElement, spec: Chart, lib: any): void {
  const { scale, shape, axis, selection } = lib;
  const W = 600, H = 300, M = { top: 20, right: 20, bottom: 40, left: 50 };
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;

  const g = selection.select(svg)
    .append('g')
    .attr('transform', `translate(${M.left},${M.top})`);

  // Collect all y values and x values
  const series = spec.series ?? [{ y: [] }];
  let allY: number[] = [];
  let allX: number[] = spec.x ? (spec.x.map(Number)) : [];
  for (const s of series) {
    for (const v of s.y) allY.push(v);
    if (s.x) for (const v of s.x) allX.push(Number(v));
  }
  if (allX.length === 0 && series[0]) allX = series[0].y.map((_, i) => i);

  const xScale = scale.scaleLinear()
    .domain([Math.min(...allX), Math.max(...allX)])
    .range([0, w]);
  const yScale = scale.scaleLinear()
    .domain([Math.min(...allY), Math.max(...allY)])
    .range([h, 0]);

  // Axes
  g.append('g').attr('transform', `translate(0,${h})`).call(axis.axisBottom(xScale).ticks(6));
  g.append('g').call(axis.axisLeft(yScale).ticks(6));

  // Axis labels
  if (spec.xLabel) {
    selection.select(svg).append('text')
      .attr('x', M.left + w / 2).attr('y', H - 2)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#8080b0')
      .text(spec.xLabel);
  }
  if (spec.yLabel) {
    selection.select(svg).append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(H / 2)).attr('y', 12)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#8080b0')
      .text(spec.yLabel);
  }

  // Plot each series
  const colors = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#845ef7', '#ff922b'];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const pts: [number, number][] = s.y.map((v, j) => [s.x?.[j] ?? allX[j] ?? j, v]);
    const color = s.color ?? colors[i % colors.length];

    type Pt = [number, number];
    if (spec.type === 'bar' || s.type === 'bar') {
      g.selectAll(`.bar-${i}`).data(pts).enter()
        .append('rect')
        .attr('x', (d: Pt) => xScale(d[0]) - w / pts.length * 0.4)
        .attr('y', (d: Pt) => yScale(Math.max(d[1], 0)))
        .attr('width', w / pts.length * 0.8)
        .attr('height', (d: Pt) => Math.abs(yScale(d[1]) - yScale(0)))
        .attr('fill', color).attr('opacity', 0.85);
    } else if (spec.type === 'scatter' || s.type === 'scatter') {
      g.selectAll(`.dots-${i}`).data(pts).enter()
        .append('circle')
        .attr('cx', (d: Pt) => xScale(d[0])).attr('cy', (d: Pt) => yScale(d[1]))
        .attr('r', 3.5).attr('fill', color).attr('opacity', 0.8);
    } else {
      // line or area
      const lineFn = shape.line()
        .x((d: Pt) => xScale(d[0]))
        .y((d: Pt) => yScale(d[1]));
      if (spec.type === 'area' || s.type === 'area') {
        const areaFn = shape.area()
          .x((d: Pt) => xScale(d[0]))
          .y0(h).y1((d: Pt) => yScale(d[1]));
        g.append('path').datum(pts)
          .attr('fill', color).attr('opacity', 0.2)
          .attr('d', areaFn);
      }
      g.append('path').datum(pts)
        .attr('fill', 'none').attr('stroke', color)
        .attr('stroke-width', 2).attr('stroke-linejoin', 'round')
        .attr('d', lineFn);
    }
  }

  // Title
  if (spec.title) {
    selection.select(svg).append('text')
      .attr('x', W / 2).attr('y', 14)
      .attr('text-anchor', 'middle').attr('font-size', 12)
      .attr('font-weight', 600).attr('fill', '#e0e0e0')
      .text(spec.title);
  }
}

function renderHeatmap(svg: SVGElement, spec: Chart, lib: any): void {
  const { scale, selection } = lib;
  const matrix = spec.matrix ?? [];
  if (matrix.length === 0) return;
  const rows = matrix.length, cols = matrix[0]?.length ?? 0;
  const cellW = 600 / cols, cellH = 300 / rows;
  const allVals = matrix.flat();
  const colorScale = scale.scaleSequential(
    scale.interpolateViridis
  ).domain([Math.min(...allVals), Math.max(...allVals)]);

  const g = selection.select(svg).append('g');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.append('rect')
        .attr('x', c * cellW).attr('y', r * cellH)
        .attr('width', cellW).attr('height', cellH)
        .attr('fill', colorScale(matrix[r][c]))
        .attr('stroke', '#1a1a2e').attr('stroke-width', 0.5);
    }
  }
}
