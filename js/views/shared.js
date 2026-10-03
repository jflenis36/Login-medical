import { EXAM_TYPES, EXAM_KEYS, evaluate, formatValue, rangeText, formatDate, normalRange, latestByType } from '../rules.js';
import { esc, $, statusBadge, makeChart, disposeChart, COLORS } from '../ui.js';

export const kpi = (label, value, { sub = '', tone = '' } = {}) => `
  <div class="kpi ${tone}">
    <span class="kpi-label">${esc(label)}</span>
    <strong class="kpi-value">${esc(value)}</strong>
    ${sub ? `<span class="kpi-sub">${esc(sub)}</span>` : ''}
  </div>`;

const NEED_ICON = { danger: '!', warn: '!', info: 'i' };
export function needsList(needs, emptyText = 'Todo en orden: no hay pendientes.') {
  if (!needs.length) return `<p class="needs-ok">${esc(emptyText)}</p>`;
  return `<ul class="needs">${needs.map((n) => `<li class="need need-${n.level}"><span class="need-ico" aria-hidden="true">${NEED_ICON[n.level]}</span><span>${esc(n.text)}</span></li>`).join('')}</ul>`;
}

// Tarjetas con el último valor de cada examen
export function latestCards(user, exams) {
  const latest = latestByType(exams);
  return `<div class="latest-grid">${EXAM_KEYS.map((type) => {
    const e = latest[type];
    const t = EXAM_TYPES[type];
    if (!e) {
      return `<div class="latest-card st-none"><span class="kpi-label">${esc(t.label)}</span><strong class="latest-val muted">--</strong><span class="kpi-sub">Sin examen registrado</span></div>`;
    }
    const st = evaluate(type, e.value, user.sex);
    return `<div class="latest-card st-card-${st}">
      <span class="kpi-label">${esc(t.label)}</span>
      <strong class="latest-val">${formatValue(type, e.value)} <small>${esc(t.unit)}</small></strong>
      <span>${statusBadge(st)}</span>
      <span class="kpi-sub">${formatDate(e.date)} · Ref: ${esc(rangeText(type, user.sex))}</span>
    </div>`;
  }).join('')}</div>`;
}

// Tabla de exámenes. opts.pdf = muestra botón de descarga por examen.
export function examsTable(user, exams, { pdf = false } = {}) {
  if (!exams.length) return '<p class="empty">Todavía no hay exámenes registrados.</p>';
  const rows = [...exams].sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Examen</th><th>Resultado</th><th>Referencia</th><th>Estado</th>${pdf ? '<th class="col-actions">PDF</th>' : ''}</tr></thead>
    <tbody>${rows.map((e) => {
      const st = evaluate(e.type, e.value, user.sex);
      return `<tr>
        <td>${formatDate(e.date)}</td>
        <td>${esc(EXAM_TYPES[e.type].label)}</td>
        <td><strong>${formatValue(e.type, e.value)}</strong> ${esc(EXAM_TYPES[e.type].unit)}</td>
        <td class="muted">${esc(rangeText(e.type, user.sex))}</td>
        <td>${statusBadge(st)}</td>
        ${pdf ? `<td class="col-actions"><button class="btn btn-ghost btn-sm" data-exam-pdf="${esc(e.id)}">Descargar</button></td>` : ''}
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

// Gráfica de evolución con selector de examen. Devuelve nada; monta en `container`.
export function mountEvolution(container, user, exams) {
  container.innerHTML = `
    <div class="card-head">
      <h3>Evolución</h3>
      <label class="inline-field"><span class="sr-only">Examen</span>
        <select id="evo-type">${EXAM_KEYS.map((k) => `<option value="${k}">${esc(EXAM_TYPES[k].label)}</option>`).join('')}</select>
      </label>
    </div>
    <div class="chart-box"><canvas id="evo-canvas" role="img" aria-label="Evolución del examen seleccionado"></canvas></div>
    <p class="empty" id="evo-empty" hidden>Aún no hay datos de este examen.</p>`;
  let chart;
  const draw = () => {
    const type = $('#evo-type', container).value;
    const pts = exams.filter((e) => e.type === type).sort((a, b) => a.date.localeCompare(b.date));
    $('#evo-empty', container).hidden = pts.length > 0;
    $('#evo-canvas', container).parentElement.hidden = pts.length === 0;
    if (chart) disposeChart(chart);
    if (!pts.length) return;
    const [min, max] = normalRange(type, user.sex);
    const labels = pts.map((p) => formatDate(p.date));
    const datasets = [{
      label: `${EXAM_TYPES[type].label} (${EXAM_TYPES[type].unit})`,
      data: pts.map((p) => p.value),
      borderColor: COLORS.teal, backgroundColor: COLORS.tealSoft, fill: false, tension: 0.25,
      pointRadius: 5, pointBackgroundColor: pts.map((p) => COLORS[evaluate(type, p.value, user.sex)] || COLORS.teal),
    }];
    const band = (v, label) => ({ label, data: pts.map(() => v), borderColor: '#9aa5b1', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false });
    if (min != null) datasets.push(band(min, 'Mínimo normal'));
    if (max != null) datasets.push(band(max, 'Máximo normal'));
    chart = makeChart($('#evo-canvas', container), {
      type: 'line',
      data: { labels, datasets },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } } },
    });
  };
  $('#evo-type', container).addEventListener('change', draw);
  draw();
}
