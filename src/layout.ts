import type { Layout, ResolvedView, RendererContext, Visual } from './types.js';

interface LayoutCtx {
  renderView: (viewId: string) => HTMLElement;
  renderLayoutNode: (layout: Layout) => HTMLElement;
}

/**
 * Render a Layout tree into a DOM element.
 * @param layout The layout tree (may be a string view reference or an object node)
 * @param views Map of view id → resolved view
 * @param ctx Renderer context for individual visual nodes
 */
export function renderLayout(
  layout: Layout,
  views: Map<string, ResolvedView>,
  ctx: RendererContext,
): HTMLElement {
  const viewRenderer = (id: string): HTMLElement => {
    const rv = views.get(id);
    if (!rv) {
      const el = document.createElement('div');
      el.textContent = `[view not found: ${id}]`;
      return el;
    }
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-exd-id', id);
    if (rv.title) {
      const title = document.createElement('div');
      title.className = 'exd-panel-title';
      title.textContent = rv.title;
      wrapper.appendChild(title);
    }
    for (const obj of rv.objects) {
      wrapper.appendChild(ctx.render(obj));
    }
    return wrapper;
  };

  const lctx: LayoutCtx = {
    renderView: viewRenderer,
    renderLayoutNode: (node) => renderLayout(node, views, ctx),
  };

  if (typeof layout === 'string') {
    return viewRenderer(layout);
  }

  switch (layout.type) {
    case 'row':
      return renderFlex(layout.children as (string | Layout)[], 'row', layout as any, lctx);
    case 'column':
      return renderFlex(layout.children as (string | Layout)[], 'column', layout as any, lctx);
    case 'stack':
      return renderFlex(layout.children as (string | Layout)[], 'column', layout as any, lctx);
    case 'grid':
      return renderGrid(layout as any, lctx);
    case 'split':
      return renderSplit(layout, lctx);
    case 'tabs':
      return renderTabs(layout, lctx);
    case 'overlay':
      return renderOverlay(layout, lctx);
    default:
      const el = document.createElement('div');
      el.textContent = `[unknown layout: ${(layout as any).type}]`;
      return el;
  }
}

function renderFlex(
  children: (string | Layout)[],
  dir: 'row' | 'column',
  _spec: any,
  lctx: LayoutCtx,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-layout-flex';
  el.style.display = 'flex';
  el.style.flexDirection = dir;
  el.style.gap = '12px';
  if (dir === 'row') el.style.flexWrap = 'wrap';
  for (const child of children) {
    const childEl = typeof child === 'string' ? lctx.renderView(child) : lctx.renderLayoutNode(child);
    if (dir === 'column') childEl.style.width = '100%';
    else childEl.style.flex = '1 1 0';
    childEl.style.minWidth = '0';
    el.appendChild(childEl);
  }
  return el;
}

function renderGrid(
  spec: { cols?: number; children: (string | Layout)[] },
  lctx: LayoutCtx,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-layout-grid';
  el.style.display = 'grid';
  el.style.gridTemplateColumns = `repeat(${spec.cols ?? 2}, 1fr)`;
  el.style.gap = '12px';
  for (const child of spec.children) {
    const childEl = typeof child === 'string' ? lctx.renderView(child) : lctx.renderLayoutNode(child);
    childEl.style.minWidth = '0';
    el.appendChild(childEl);
  }
  return el;
}

function renderSplit(
  spec: { direction: 'horizontal' | 'vertical'; ratio?: number[]; children: (string | Layout)[] },
  lctx: LayoutCtx,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-layout-split';
  el.style.display = 'flex';
  el.style.flexDirection = spec.direction === 'horizontal' ? 'row' : 'column';
  el.style.width = '100%';
  el.style.minHeight = '300px';
  el.style.overflow = 'hidden';
  const ratios = spec.ratio ?? spec.children.map(() => 1);

  spec.children.forEach((child, i) => {
    const childEl = typeof child === 'string' ? lctx.renderView(child) : lctx.renderLayoutNode(child);
    childEl.style.flex = String(ratios[i] ?? 1);
    childEl.style.minWidth = '0';
    childEl.style.overflow = 'auto';
    if (i < spec.children.length - 1) {
      childEl.style.borderRight = spec.direction === 'horizontal' ? '1px solid #2a2a4a' : 'none';
      childEl.style.borderBottom = spec.direction === 'vertical' ? '1px solid #2a2a4a' : 'none';
    }
    el.appendChild(childEl);
  });
  return el;
}

function renderTabs(
  spec: { tabs: { label: string; content: string | Layout }[] },
  lctx: LayoutCtx,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-layout-tabs';

  // Tab bar
  const bar = document.createElement('div');
  bar.className = 'exd-tab-bar';
  bar.style.display = 'flex';
  bar.style.borderBottom = '1px solid #2a2a4a';
  bar.style.marginBottom = '8px';

  // Content container
  const content = document.createElement('div');
  content.className = 'exd-tab-content';

  const tabs = spec.tabs;
  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = 'exd-tab-btn';
    btn.textContent = tab.label;
    btn.style.cssText = `
      padding: 6px 14px;
      background: none;
      border: none;
      color: ${i === 0 ? '#e0e0e0' : '#8080b0'};
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      border-bottom: 2px solid ${i === 0 ? '#4a9eff' : 'transparent'};
    `;

    const tabContent = typeof tab.content === 'string'
      ? lctx.renderView(tab.content)
      : lctx.renderLayoutNode(tab.content);
    tabContent.style.display = i === 0 ? 'block' : 'none';

    let activeIdx = 0;
    btn.addEventListener('click', () => {
      // Update all buttons
      const allBtns = bar.querySelectorAll('.exd-tab-btn');
      allBtns.forEach((b, j) => {
        (b as HTMLElement).style.color = j === i ? '#e0e0e0' : '#8080b0';
        (b as HTMLElement).style.borderBottomColor = j === i ? '#4a9eff' : 'transparent';
      });
      // Show/hide content
      const allContent = content.querySelectorAll(':scope > *');
      allContent.forEach((c, j) => {
        (c as HTMLElement).style.display = j === i ? 'block' : 'none';
      });
      activeIdx = i;
    });

    bar.appendChild(btn);
    content.appendChild(tabContent);
  });

  el.appendChild(bar);
  el.appendChild(content);
  return el;
}

function renderOverlay(
  spec: { base: string | Layout; overlays: { id: string; position: string; content: string | Layout }[] },
  lctx: LayoutCtx,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-layout-overlay';
  el.style.position = 'relative';
  el.style.width = '100%';
  el.style.minHeight = '300px';

  const baseEl = typeof spec.base === 'string' ? lctx.renderView(spec.base) : lctx.renderLayoutNode(spec.base);
  baseEl.style.position = 'absolute';
  baseEl.style.inset = '0';
  el.appendChild(baseEl);

  for (const ov of spec.overlays) {
    const ovEl = document.createElement('div');
    ovEl.className = 'exd-layout-overlay-item';
    ovEl.style.position = 'absolute';
    ovEl.style.zIndex = '10';
    ovEl.style.maxWidth = '40%';
    const posMap: Record<string, string> = {
      'top-right': 'top:8px;right:8px',
      'top-left': 'top:8px;left:8px',
      'bottom-right': 'bottom:8px;right:8px',
      'bottom-left': 'bottom:8px;left:8px',
    };
    ovEl.style.cssText += posMap[ov.position] ?? 'top:8px;right:8px';

    const inner = typeof ov.content === 'string' ? lctx.renderView(ov.content) : lctx.renderLayoutNode(ov.content);
    ovEl.appendChild(inner);
    el.appendChild(ovEl);
  }

  return el;
}
