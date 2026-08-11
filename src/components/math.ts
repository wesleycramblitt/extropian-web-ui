import type { RendererContext } from '../types.js';
import type { Math } from '../types.js';

let katexModule: any = null;
let katexLoading = false;

async function loadKatex(): Promise<any> {
  if (katexModule) return katexModule;
  if (katexLoading) {
    return new Promise(resolve => {
      const check = setInterval(() => { if (katexModule) { clearInterval(check); resolve(katexModule); } }, 50);
    });
  }
  katexLoading = true;
  try {
    katexModule = await import('katex');
    // Inject KaTeX CSS link dynamically (avoids cross-project CSS module resolution)
    if (!document.querySelector('link[data-katex]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-katex', '1');
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
      document.head.appendChild(link);
    }
  } catch (e) {
    console.warn('[extropian-web-ui] KaTeX unavailable — displaying raw LaTeX');
    katexModule = null;
  }
  katexLoading = false;
  return katexModule;
}

export function renderMath(spec: Math, _ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-math-block';

  if (!spec.source) {
    el.textContent = '(empty)';
    return el;
  }

  // Try sync — if already loaded
  if (katexModule) {
    renderWithKatex(el, spec.source, spec.display ?? true);
  } else {
    // Show raw LaTeX as a placeholder
    el.classList.add('exd-math-placeholder');
    el.textContent = spec.source;

    loadKatex().then(() => {
      if (katexModule && el.parentNode) {
        el.classList.remove('exd-math-placeholder');
        el.textContent = '';
        renderWithKatex(el, spec.source, spec.display ?? true);
      }
    });
  }

  return el;
}

function renderWithKatex(el: HTMLElement, source: string, display: boolean): void {
  try {
    katexModule.render(source, el, {
      displayMode: display,
      throwOnError: false,
      trust: false,
    });
  } catch (e) {
    console.error('[math] KaTeX render error:', e);
    el.textContent = source;
  }
}
