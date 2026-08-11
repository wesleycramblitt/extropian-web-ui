import type { RendererContext } from '../types.js';
import type { Graph } from '../types.js';

let d3Force: any = null;
let forceLoading = false;

async function loadForce(): Promise<any> {
  if (d3Force) return d3Force;
  if (forceLoading) {
    return new Promise(resolve => {
      const check = setInterval(() => { if (d3Force) { clearInterval(check); resolve(d3Force); } }, 50);
    });
  }
  forceLoading = true;
  try {
    const [force, selection, drag] = await Promise.all([
      import('d3-force'),
      import('d3-selection'),
      import('d3-zoom'),
    ]);
    d3Force = { force, selection, drag };
  } catch (e) {
    console.warn('[graph] d3-force unavailable');
    d3Force = null;
  }
  forceLoading = false;
  return d3Force;
}

export function renderGraph(spec: Graph, _ctx: RendererContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'exd-graph';

  // Placeholder while loading
  const placeholder = document.createElement('div');
  placeholder.className = 'exd-math-block';
  placeholder.style.textAlign = 'center';
  placeholder.style.padding = '60px 16px';
  placeholder.innerHTML = '<div style="font-size:32px;">\u{1F578}\u{FE0F}</div><div style="color:#8080b0;font-size:13px;">Graph &middot; loading layout...</div>';
  container.appendChild(placeholder);

  loadForce().then(() => {
    if (!d3Force) {
      placeholder.innerHTML += '<div style="color:#ff8888;margin-top:8px;">d3-force unavailable</div>';
      return;
    }
    placeholder.remove();
    renderForceGraph(container, spec);
  });

  return container;
}

function renderForceGraph(container: HTMLElement, spec: Graph): void {
  const { force, selection, drag: _drag } = d3Force;
  const width = 600, height = 400;

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgEl.style.width = '100%';
  svgEl.style.height = '100%';
  container.appendChild(svgEl);

  const svg = selection.select(svgEl);

  // Build data
  const nodes = spec.nodes.map(n => ({ id: n.id, label: n.label ?? n.id }));
  const links = spec.edges.map(e => {
    const src = nodes.find(n => n.id === e.source) ?? nodes[0];
    const tgt = nodes.find(n => n.id === e.target) ?? nodes[0];
    return { source: src, target: tgt, label: e.label };
  });

  // Simulation
  const sim = force.forceSimulation(nodes)
    .force('link', force.forceLink(links).id((d: any) => d.id).distance(100))
    .force('charge', force.forceManyBody().strength(-300))
    .force('center', force.forceCenter(width / 2, height / 2))
    .force('collision', force.forceCollide().radius(25));

  // Draw edges
  const edge = svg.append('g').selectAll('line')
    .data(links).join('line')
    .attr('class', 'exd-graph-edge');

  // Edge labels
  const edgeLabel = svg.append('g').selectAll('text')
    .data(links).join('text')
    .attr('fill', '#8080b0').attr('font-size', 9)
    .attr('text-anchor', 'middle')
    .text((d: any) => d.label ?? '');

  // Draw nodes
  const node = svg.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('class', 'exd-graph-node');

  node.append('circle').attr('r', 16);
  node.append('text').text((d: any) => d.label);

  // Drag
  const dragHandler = force.drag()
    .on('start', (event: any, d: any) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event: any, d: any) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null; d.fy = null;
    });
  node.call(dragHandler);

  // Tick
  sim.on('tick', () => {
    edge
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);
    edgeLabel
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 5);
    node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  });
}
