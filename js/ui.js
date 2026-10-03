import { STATUS, ROLES } from './rules.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, type = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

export const statusBadge = (status) => `<span class="badge st-${status}">${esc(STATUS[status].label)}</span>`;
export const roleBadge = (role) => `<span class="badge role-${role}">${esc(ROLES[role])}</span>`;
export const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// ---- Modal (usa <dialog>: foco atrapado y cierre con Esc) ----
export function openModal({ title, body, submitText = 'Guardar', cancelText = 'Cancelar', onSubmit, onMount }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <form method="dialog" class="modal-form" novalidate>
      <header class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">&times;</button></header>
      <div class="modal-body">${body}</div>
      <p class="form-error" role="alert" hidden></p>
      <footer class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>${esc(cancelText)}</button>
        ${onSubmit ? `<button type="submit" class="btn btn-primary">${esc(submitText)}</button>` : ''}
      </footer>
    </form>`;
  document.body.appendChild(dlg);
  const form = $('form', dlg);
  const errBox = $('.form-error', dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', close));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errBox.hidden = true;
    try {
      const result = onSubmit?.(form, close);
      if (result !== false) close();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    }
  });
  dlg.showModal();
  onMount?.(form);
  return close;
}

// ---- Paginación ----
export function paginate(items, page, size) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length, size };
}

export function renderPager(container, p, onPage) {
  if (p.total === 0) { container.innerHTML = ''; return; }
  const from = (p.page - 1) * p.size + 1;
  const to = Math.min(p.total, p.page * p.size);
  const nums = [];
  for (let i = 1; i <= p.pages; i++) {
    if (i === 1 || i === p.pages || Math.abs(i - p.page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  container.innerHTML = `
    <span class="pager-info">${from}-${to} de ${p.total}</span>
    <nav class="pager-nav" aria-label="Paginación">
      <button class="btn btn-ghost btn-sm" data-page="${p.page - 1}" ${p.page === 1 ? 'disabled' : ''}>Anterior</button>
      ${nums.map((n) => (n === '…' ? '<span class="pager-gap">…</span>' : `<button class="btn btn-sm ${n === p.page ? 'btn-primary' : 'btn-ghost'}" data-page="${n}" ${n === p.page ? 'aria-current="page"' : ''}>${n}</button>`)).join('')}
      <button class="btn btn-ghost btn-sm" data-page="${p.page + 1}" ${p.page === p.pages ? 'disabled' : ''}>Siguiente</button>
    </nav>`;
  $$('[data-page]', container).forEach((b) => b.addEventListener('click', () => onPage(Number(b.dataset.page))));
}

// ---- Gráficas (Chart.js global desde vendor/) ----
const charts = [];
export function destroyCharts() { while (charts.length) charts.pop().destroy(); }
export function disposeChart(chart) {
  const i = charts.indexOf(chart);
  if (i >= 0) charts.splice(i, 1);
  chart.destroy();
}

export const COLORS = {
  teal: '#0f766e', tealSoft: 'rgba(15,118,110,.15)',
  normal: '#1a7f4b', borderline: '#c28a1b', high: '#c0392b', low: '#2563a8',
  grid: '#e5e9ee', text: '#52606d',
};

export function makeChart(canvas, config) {
  const Chart = window.Chart;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = COLORS.text;
  config.options = { responsive: true, maintainAspectRatio: false, ...config.options };
  const chart = new Chart(canvas, config);
  charts.push(chart);
  return chart;
}

// ---- Descargas ----
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
