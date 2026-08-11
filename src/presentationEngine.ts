// PresentationEngine — applies ScenePresentationState to a rendered DOM.
// Handles: focus glow, dim/isolation, annotations (callout/tooltip/label),
// and animation clips (pulse/highlight/fade/slide).
import type { ScenePresentationState, SceneAnnotation, SceneAnimationClip } from './types.js';

/**
 * Apply presentation state to a container element.
 * @param container The root container element.
 * @param ps The presentation state to apply.
 */
export function applyPresentationState(
  container: HTMLElement,
  ps: ScenePresentationState,
): void {
  // 1. Apply focus_entity highlight
  if (ps.focus_entity) {
    applyFocusGlow(container, ps.focus_entity);
  }

  // 2. Apply style overrides
  for (const [entityId, override] of Object.entries(ps.overrides)) {
    applyStyleOverride(container, entityId, override);
  }

  // 3. Apply annotations
  for (const ann of ps.annotations) {
    applyAnnotation(container, ann);
  }

  // 4. Apply animations
  for (const clip of ps.animations) {
    applyAnimationClip(container, clip);
  }

  // 5. Apply selection highlighting
  for (const selId of ps.selection) {
    applySelectionHighlight(container, selId);
  }
}

function findEntity(container: HTMLElement, entityId: string): HTMLElement | null {
  return container.querySelector(`[data-exd-id="${entityId}"]`) as HTMLElement | null;
}

// ── Focus glow ──────────────────────────────────────────────────────────────

function applyFocusGlow(container: HTMLElement, entityId: string): void {
  const el = findEntity(container, entityId);
  if (!el) return;
  el.style.transition = 'box-shadow 0.3s ease, outline 0.3s ease';
  el.style.boxShadow = '0 0 12px 2px rgba(74, 158, 255, 0.6)';
  el.style.outline = '2px solid #4a9eff';
  el.style.outlineOffset = '2px';
  el.style.position = 'relative';
  el.style.zIndex = '5';
}

// ── Style overrides ─────────────────────────────────────────────────────────

function applyStyleOverride(
  container: HTMLElement,
  entityId: string,
  override: { emphasis: string; opacity: number },
): void {
  const el = findEntity(container, entityId);
  if (!el) return;
  el.style.opacity = String(override.opacity);

  // Emphasis levels
  const glowMap: Record<string, string> = {
    prominent: '0 0 12px 2px rgba(255, 200, 50, 0.7)',
    primary: '0 0 8px 1px rgba(74, 158, 255, 0.5)',
    subtle: '0 0 2px 0px rgba(100, 100, 150, 0.2)',
    default: 'none',
  };
  if (override.emphasis && override.emphasis !== 'default') {
    el.style.boxShadow = glowMap[override.emphasis] ?? 'none';
  }
}

// ── Selection highlight ─────────────────────────────────────────────────────

function applySelectionHighlight(container: HTMLElement, entityId: string): void {
  const el = findEntity(container, entityId);
  if (!el) return;
  el.setAttribute('data-exd-selected', 'true');
  el.style.outline = '2px solid #4a9eff';
  el.style.outlineOffset = '1px';
}

// ── Annotations ─────────────────────────────────────────────────────────────

function applyAnnotation(
  container: HTMLElement,
  ann: SceneAnnotation,
): void {
  const target = findEntity(container, ann.target);
  if (!target) return;

  const label = document.createElement('div');
  label.className = `exd-annotation exd-annotation-${ann.style}`;
  label.textContent = ann.text;

  const isCallout = ann.style === 'callout';
  const isTooltip = ann.style === 'tooltip';

  const baseStyle = `
    position: absolute;
    background: ${isTooltip ? '#0e0e2a' : '#1a1a4e'};
    border: 1px solid #4a9eff;
    color: #e0e0e0;
    padding: ${isTooltip ? '4px 8px' : '6px 12px'};
    border-radius: ${isTooltip ? '4px' : '6px'};
    font-size: ${isTooltip ? '11px' : '12px'};
    white-space: nowrap;
    z-index: 30;
    pointer-events: none;
    ${isCallout ? 'font-weight: 500;' : ''}
  `;

  label.style.cssText = baseStyle;
  label.setAttribute('data-annotation-id', ann.id);

  const rect = target.getBoundingClientRect();
  const parentRect = container.getBoundingClientRect();

  // Position relative to container
  const targetCenterX = rect.left - parentRect.left + rect.width / 2;
  const targetCenterY = rect.top - parentRect.top + rect.height / 2;
  const gap = 8;

  switch (ann.position) {
    case 'above':
      label.style.left = `${targetCenterX}px`;
      label.style.transform = 'translateX(-50%)';
      label.style.bottom = `${parentRect.height - (rect.top - parentRect.top) + gap}px`;
      break;
    case 'below':
      label.style.left = `${targetCenterX}px`;
      label.style.transform = 'translateX(-50%)';
      label.style.top = `${rect.bottom - parentRect.top + gap}px`;
      break;
    case 'left':
      label.style.top = `${targetCenterY}px`;
      label.style.transform = 'translateY(-50%)';
      label.style.right = `${parentRect.width - (rect.left - parentRect.left) + gap}px`;
      break;
    case 'right':
      label.style.top = `${targetCenterY}px`;
      label.style.transform = 'translateY(-50%)';
      label.style.left = `${rect.right - parentRect.left + gap}px`;
      break;
    case 'center':
      label.style.left = `${targetCenterX}px`;
      label.style.top = `${targetCenterY}px`;
      label.style.transform = 'translate(-50%, -50%)';
      break;
  }

  // Ensure container has relative positioning for absolute children
  if (container.style.position === 'static' || !container.style.position) {
    container.style.position = 'relative';
  }
  container.appendChild(label);

  // Auto-remove tooltips after 5 seconds
  if (isTooltip) {
    setTimeout(() => label.remove(), 5000);
  }
}

// ── Animations ──────────────────────────────────────────────────────────────

function applyAnimationClip(
  container: HTMLElement,
  clip: SceneAnimationClip,
): void {
  const el = findEntity(container, clip.target);
  if (!el) return;

  const durationMs = (clip.duration * 1000).toFixed(0);
  const easingMap: Record<string, string> = {
    ease_out: 'ease-out',
    ease_in: 'ease-in',
    linear: 'linear',
  };
  const easing = easingMap[clip.easing] ?? 'ease-out';

  const keyframeMap: Record<string, Keyframe[]> = {
    pulse: [
      { transform: 'scale(1)', opacity: '1' },
      { transform: 'scale(1.05)', opacity: '0.8', offset: 0.3 },
      { transform: 'scale(1.08)', opacity: '1', offset: 0.5 },
      { transform: 'scale(1.05)', opacity: '0.8', offset: 0.7 },
      { transform: 'scale(1)', opacity: '1' },
    ],
    highlight: [
      { boxShadow: '0 0 0px rgba(74,158,255,0)', outlineColor: 'transparent' },
      { boxShadow: '0 0 16px rgba(74,158,255,0.8)', outlineColor: '#4a9eff', offset: 0.4 },
      { boxShadow: '0 0 8px rgba(74,158,255,0.4)', outlineColor: '#4a9eff', offset: 0.6 },
      { boxShadow: '0 0 0px rgba(74,158,255,0)', outlineColor: 'transparent' },
    ],
    fade_in: [
      { opacity: '0', transform: 'translateY(6px)' },
      { opacity: '1', transform: 'translateY(0)' },
    ],
    fade_out: [
      { opacity: '1' },
      { opacity: '0' },
    ],
    slide_in: [
      { transform: 'translateX(-20px)', opacity: '0' },
      { transform: 'translateX(0)', opacity: '1' },
    ],
    scale_up: [
      { transform: 'scale(0.8)', opacity: '0' },
      { transform: 'scale(1)', opacity: '1' },
    ],
  };

  const keyframes = keyframeMap[clip.effect];
  if (!keyframes) return;

  try {
    el.animate(keyframes, {
      duration: clip.duration * 1000,
      easing,
      fill: 'forwards',
    });
  } catch {
    // Fallback: just apply the final state
    const lastFrame = keyframes[keyframes.length - 1];
    if (lastFrame) {
      Object.assign(el.style, lastFrame);
    }
  }
}

/**
 * Clear all presentation effects from a container.
 */
export function clearPresentationState(container: HTMLElement): void {
  // Remove annotations
  container.querySelectorAll('[data-annotation-id]').forEach(el => el.remove());

  // Clear style overrides on entities
  container.querySelectorAll('[data-exd-id]').forEach(el => {
    const e = el as HTMLElement;
    e.style.boxShadow = '';
    e.style.outline = '';
    e.style.outlineOffset = '';
    e.style.opacity = '';
    e.style.position = '';
    e.style.zIndex = '';
    e.style.transform = '';
    e.removeAttribute('data-exd-selected');
    // Cancel any running animations
    e.getAnimations().forEach(a => a.cancel());
  });
}
