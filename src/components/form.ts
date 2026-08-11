import type { RendererContext } from '../types.js';
import type { Form, Field } from '../types.js';

export function renderForm(spec: Form, ctx: RendererContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'exd-form';

  for (const field of spec.fields) {
    const fieldEl = renderField(field, ctx);
    el.appendChild(fieldEl);
  }

  return el;
}

function renderField(field: Field, ctx: RendererContext): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'exd-form-field';

  if (field.label) {
    const lbl = document.createElement('label');
    lbl.className = 'exd-form-label';
    lbl.textContent = field.label;
    wrapper.appendChild(lbl);
  }

  const emit = (value: unknown) => {
    const action = field.action ?? `field:${field.name}`;
    ctx.emit(action, { name: field.name, value });
  };

  switch (field.type) {
    case 'number': {
      const input = document.createElement('input');
      input.className = 'exd-form-input';
      input.type = 'number';
      if (field.value !== undefined) input.value = String(field.value);
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      input.addEventListener('input', () => emit(parseFloat(input.value)));
      wrapper.appendChild(input);
      break;
    }
    case 'text': {
      const input = document.createElement('input');
      input.className = 'exd-form-input';
      input.type = 'text';
      if (field.value !== undefined) input.value = String(field.value);
      input.addEventListener('input', () => emit(input.value));
      wrapper.appendChild(input);
      break;
    }
    case 'complex': {
      const row = document.createElement('div');
      row.className = 'exd-form-field-row';

      const realPart = typeof field.value === 'number' ? field.value : 0;
      const imagPart = 0;
      const re = document.createElement('input');
      re.className = 'exd-form-input';
      re.type = 'number';
      re.value = String(realPart);
      re.placeholder = 'Re';
      re.style.width = '80px';
      re.addEventListener('input', () => emit({ re: parseFloat(re.value), im: parseFloat(im.value) }));

      const plus = document.createElement('span');
      plus.textContent = ' + ';
      plus.style.color = '#8080b0';
      plus.style.fontSize = '13px';

      const im = document.createElement('input');
      im.className = 'exd-form-input';
      im.type = 'number';
      im.value = String(imagPart);
      im.placeholder = 'Im';
      im.style.width = '80px';
      im.addEventListener('input', () => emit({ re: parseFloat(re.value), im: parseFloat(im.value) }));

      const iLabel = document.createElement('span');
      iLabel.textContent = ' i';
      iLabel.style.color = '#8080b0';
      iLabel.style.fontSize = '13px';

      row.appendChild(re);
      row.appendChild(plus);
      row.appendChild(im);
      row.appendChild(iLabel);
      wrapper.appendChild(row);
      break;
    }
    case 'select': {
      const sel = document.createElement('select');
      sel.className = 'exd-form-select';
      for (const opt of field.options ?? []) {
        const o = document.createElement('option');
        o.value = o.textContent = opt;
        if (opt === String(field.value)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => emit(sel.value));
      wrapper.appendChild(sel);
      break;
    }
    case 'boolean': {
      const cbRow = document.createElement('label');
      cbRow.className = 'exd-form-checkbox';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      if (field.value === true) cb.checked = true;
      cb.addEventListener('change', () => emit(cb.checked));
      cbRow.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = field.label ?? field.name;
      cbRow.appendChild(span);
      wrapper.innerHTML = '';
      wrapper.appendChild(cbRow);
      break;
    }
    case 'range': {
      const row = document.createElement('div');
      row.className = 'exd-form-field-row';
      const range = document.createElement('input');
      range.className = 'exd-form-range';
      range.type = 'range';
      range.min = String(field.min ?? 0);
      range.max = String(field.max ?? 100);
      range.step = String(field.step ?? 1);
      range.value = String(field.value ?? 50);
      const val = document.createElement('span');
      val.style.fontSize = '12px';
      val.style.color = '#a0a0c0';
      val.style.minWidth = '30px';
      val.textContent = range.value;
      range.addEventListener('input', () => {
        val.textContent = range.value;
        emit(parseFloat(range.value));
      });
      row.appendChild(range);
      row.appendChild(val);
      wrapper.appendChild(row);
      break;
    }
  }

  return wrapper;
}
