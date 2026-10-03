import * as db from '../db.js';
import {
  EXAM_TYPES, EXAM_KEYS, SEX, evaluate, formatDate, todayISO, needsFor, needsLevel, overallStatus,
  latestByType, rangeText,
} from '../rules.js';
import { $, $$, esc, toast, openModal, paginate, renderPager, statusBadge, initials, makeChart, COLORS } from '../ui.js';
import { kpi, needsList, examsTable, mountEvolution, latestCards } from './shared.js';
import { downloadPatientPDF, buildReportRows, downloadReportCSV, downloadReportXLSX } from '../export.js';

const PAGE_SIZE = 8;
const LEVEL_ORDER = { danger: 0, warn: 1, info: 2, ok: 3 };
const LEVEL_LABEL = { danger: 'Requiere atención', warn: 'Seguimiento', info: 'Pendiente de exámenes', ok: 'Al día' };

// Datos calculados por cliente (lista de exámenes, estado, necesidades)
function clientRows() {
  const exams = db.getExams();
  return db.getUsers().filter((u) => u.role === 'client').map((u) => {
    const mine = exams.filter((e) => e.userId === u.id);
    const needs = needsFor(u, mine);
    const last = mine.reduce((m, e) => (e.date > m ? e.date : m), '');
    return { user: u, exams: mine, needs, level: needsLevel(needs), status: overallStatus(u, mine), last };
  });
}

// ---------- Lista de pacientes ----------
export function renderStaffHome(root) {
  const state = { q: '', filter: '', page: 1 };
  const rows = clientRows();

  const latestAll = rows.flatMap((r) => Object.entries(latestByType(r.exams)).map(([type, e]) => ({ type, st: evaluate(type, e.value, r.user.sex) })));
  const outOfRange = latestAll.filter((x) => x.st === 'high' || x.st === 'low').length;
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const since = d30.toISOString().slice(0, 10);

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Pacientes</h2><p class="muted">Consulta los exámenes de cada cliente y qué necesita.</p></div>
      <a class="btn btn-primary" href="#/staff/reports">Reportes por fecha</a>
    </div>
    <div class="kpi-row">
      ${kpi('Clientes', rows.length)}
      ${kpi('Requieren atención', rows.filter((r) => r.level === 'danger').length, { sub: 'valores fuera de rango', tone: 'danger' })}
      ${kpi('En seguimiento', rows.filter((r) => r.level === 'warn').length, { sub: 'valores en límite', tone: 'warn' })}
      ${kpi('Sin exámenes', rows.filter((r) => !r.exams.length).length)}
      ${kpi('Exámenes (30 días)', db.getExams().filter((e) => e.date >= since).length)}
      ${kpi('Resultados fuera de rango', latestAll.length ? `${Math.round((outOfRange / latestAll.length) * 100)}%` : '0%', { sub: 'último examen por cliente' })}
    </div>
    <section class="card">
      <h3>Estado del último resultado por examen</h3>
      <div class="chart-box sm"><canvas id="ch-status" role="img" aria-label="Estado de los últimos resultados por tipo de examen"></canvas></div>
    </section>
    <section class="card">
      <div class="card-head"><h3>Clientes</h3>
        <div class="filters">
          <input type="search" id="q" placeholder="Buscar por nombre, correo o documento" aria-label="Buscar clientes">
          <select id="f" aria-label="Filtrar clientes">
            <option value="">Todos</option>
            <option value="danger">Requieren atención</option>
            <option value="warn">En seguimiento</option>
            <option value="info">Pendientes de exámenes</option>
            <option value="ok">Al día</option>
          </select>
        </div>
      </div>
      <div id="tbl"></div><div class="pager" id="pager"></div>
    </section>`;

  const statusData = ['normal', 'borderline', 'low', 'high'].map((st) => ({
    label: { normal: 'Normal', borderline: 'Límite', low: 'Bajo', high: 'Alto' }[st],
    backgroundColor: COLORS[st],
    data: EXAM_KEYS.map((k) => latestAll.filter((x) => x.type === k && x.st === st).length),
  }));
  makeChart($('#ch-status', root), {
    type: 'bar',
    data: { labels: EXAM_KEYS.map((k) => EXAM_TYPES[k].label), datasets: statusData },
    options: {
      indexAxis: 'y',
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true, ticks: { precision: 0 }, grid: { color: COLORS.grid } }, y: { stacked: true, grid: { display: false } } },
    },
  });

  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const list = rows
      .filter((r) => (!state.filter || r.level === state.filter) && (!q || [r.user.name, r.user.email, r.user.document].some((v) => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.user.name.localeCompare(b.user.name, 'es'));
    const p = paginate(list, state.page, PAGE_SIZE);
    state.page = p.page;
    $('#tbl', root).innerHTML = p.total === 0 ? '<p class="empty">No hay clientes con ese filtro.</p>' : `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Cliente</th><th>Documento</th><th>Último examen</th><th>Estado</th><th>Qué necesita</th><th class="col-actions"></th></tr></thead>
        <tbody>${p.rows.map((r) => `<tr>
          <td><div class="person"><span class="avatar" aria-hidden="true">${esc(initials(r.user.name))}</span><div><strong>${esc(r.user.name)}</strong><br><span class="muted">${esc(r.user.email)}</span></div></div></td>
          <td>${esc(r.user.document || '-')}</td>
          <td>${r.last ? formatDate(r.last) : '<span class="muted">-</span>'}</td>
          <td>${statusBadge(r.status)}</td>
          <td class="need-cell">${r.needs.length ? `<span class="need-dot lv-${r.level}" title="${esc(LEVEL_LABEL[r.level])}"></span>${esc(r.needs[0].text)}${r.needs.length > 1 ? ` <span class="muted">(+${r.needs.length - 1} más)</span>` : ''}` : '<span class="muted">Al día</span>'}</td>
          <td class="col-actions"><a class="btn btn-ghost btn-sm" href="#/staff/client/${esc(r.user.id)}">Ver exámenes</a></td>
        </tr>`).join('')}</tbody></table></div>`;
    renderPager($('#pager', root), p, (n) => { state.page = n; draw(); });
  };
  $('#q', root).addEventListener('input', (e) => { state.q = e.target.value; state.page = 1; draw(); });
  $('#f', root).addEventListener('change', (e) => { state.filter = e.target.value; state.page = 1; draw(); });
  draw();
}

// ---------- Detalle de un paciente ----------
export function renderStaffClient(root, me, id) {
  const user = db.getUser(id);
  if (!user || user.role !== 'client') {
    root.innerHTML = '<p class="empty">Cliente no encontrado.</p><a class="btn btn-ghost" href="#/staff">Volver</a>';
    return;
  }

  const draw = () => {
    const exams = db.getExamsByUser(id);
    const needs = needsFor(user, exams);
    root.innerHTML = `
      <a class="back" href="#/staff">&larr; Volver a pacientes</a>
      <div class="page-head">
        <div class="person big"><span class="avatar" aria-hidden="true">${esc(initials(user.name))}</span>
          <div><h2>${esc(user.name)}</h2>
          <p class="muted">${esc(user.email)} · Doc. ${esc(user.document || '-')} · ${esc(SEX[user.sex] || '-')} · Nac. ${formatDate(user.birthdate)}</p></div>
        </div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="add-exam">+ Registrar examen</button>
          <button class="btn btn-primary" id="pdf-all" ${exams.length ? '' : 'disabled'}>Descargar PDF</button>
        </div>
      </div>
      ${latestCards(user, exams)}
      <div class="grid-2-1">
        <section class="card" id="evo"></section>
        <section class="card"><h3>Qué necesita</h3>${needsList(needs)}</section>
      </div>
      <section class="card"><h3>Historial de exámenes</h3>${examsTable(user, exams, { pdf: true })}</section>`;
    mountEvolution($('#evo', root), user, exams);
    $('#pdf-all', root).addEventListener('click', () => downloadPatientPDF(user, exams));
    $('#add-exam', root).addEventListener('click', () => openExamModal());
    $$('[data-exam-pdf]', root).forEach((b) => b.addEventListener('click', () => {
      const e = exams.find((x) => x.id === b.dataset.examPdf);
      downloadPatientPDF(user, [e], { title: `Resultado de ${EXAM_TYPES[e.type].label}`, suffix: `${e.type}`, allExams: exams });
    }));
  };

  function openExamModal() {
    openModal({
      title: `Registrar examen — ${user.name}`,
      submitText: 'Guardar examen',
      body: `
        <div class="grid-2">
          <label class="field"><span>Examen</span><select name="type">${EXAM_KEYS.map((k) => `<option value="${k}">${esc(EXAM_TYPES[k].label)} (${esc(EXAM_TYPES[k].unit)})</option>`).join('')}</select></label>
          <label class="field"><span>Resultado</span><input type="number" name="value" step="0.1" min="0" inputmode="decimal" required></label>
        </div>
        <label class="field"><span>Fecha</span><input type="date" name="date" value="${todayISO()}" max="${todayISO()}" required></label>
        <label class="field"><span>Notas (opcional)</span><textarea name="notes" rows="2"></textarea></label>
        <p class="muted" id="ref-hint"></p>`,
      onMount(form) {
        const hint = $('#ref-hint', form);
        const upd = () => { hint.textContent = `Valor de referencia: ${rangeText(form.elements.type.value, user.sex)}`; };
        form.elements.type.addEventListener('change', upd);
        upd();
      },
      onSubmit(form) {
        const f = form.elements;
        const value = Number(f.value.value);
        if (!f.value.value || !(value > 0) || value > 2000) throw new Error('Escribe un resultado válido (mayor que 0).');
        if (!f.date.value || f.date.value > todayISO()) throw new Error('La fecha no puede estar vacía ni ser futura.');
        db.addExam({ userId: id, type: f.type.value, value, date: f.date.value, staffId: me.id, notes: f.notes.value });
        toast('Examen registrado.');
        draw();
      },
    });
  }
  draw();
}

// ---------- Reportes por fecha ----------
export function renderStaffReports(root) {
  const d = new Date(); d.setDate(d.getDate() - 90);
  const state = { from: d.toISOString().slice(0, 10), to: todayISO(), types: new Set(EXAM_KEYS), page: 1 };

  root.innerHTML = `
    <a class="back" href="#/staff">&larr; Volver a pacientes</a>
    <div class="page-head"><div><h2>Reporte general de exámenes</h2><p class="muted">Todos los clientes, limitado por fechas. Descárgalo en CSV o Excel.</p></div></div>
    <section class="card">
      <div class="report-filters">
        <label class="field"><span>Desde</span><input type="date" id="from" value="${state.from}" max="${todayISO()}"></label>
        <label class="field"><span>Hasta</span><input type="date" id="to" value="${state.to}" max="${todayISO()}"></label>
        <fieldset class="field"><legend>Exámenes</legend>
          <div class="check-row">${EXAM_KEYS.map((k) => `<label class="check"><input type="checkbox" data-type="${k}" checked> ${esc(EXAM_TYPES[k].label)}</label>`).join('')}</div>
        </fieldset>
      </div>
      <p class="form-error" id="rep-err" role="alert" hidden></p>
      <div class="btn-row">
        <button class="btn btn-primary" id="dl-xlsx">Descargar Excel (.xlsx)</button>
        <button class="btn btn-ghost" id="dl-csv">Descargar CSV</button>
      </div>
    </section>
    <div class="kpi-row" id="rep-kpis"></div>
    <section class="card"><h3>Vista previa</h3><div id="tbl"></div><div class="pager" id="pager"></div></section>`;

  const usersById = new Map(db.getUsers().map((u) => [u.id, u]));
  const current = () => {
    const exams = db.getExams().filter((e) => e.date >= state.from && e.date <= state.to && state.types.has(e.type));
    return buildReportRows(exams, usersById);
  };
  const validate = () => {
    const err = $('#rep-err', root);
    const msg = !state.from || !state.to ? 'Selecciona ambas fechas.'
      : state.from > state.to ? 'La fecha "Desde" no puede ser posterior a "Hasta".'
      : !state.types.size ? 'Selecciona al menos un tipo de examen.' : '';
    err.textContent = msg;
    err.hidden = !msg;
    return !msg;
  };

  const draw = () => {
    const ok = validate();
    $('#dl-xlsx', root).disabled = $('#dl-csv', root).disabled = !ok;
    if (!ok) { $('#rep-kpis', root).innerHTML = ''; $('#tbl', root).innerHTML = ''; $('#pager', root).innerHTML = ''; return; }
    const rows = current();
    const abnormal = rows.filter((r) => r.status === 'Alto' || r.status === 'Bajo').length;
    $('#rep-kpis', root).innerHTML =
      kpi('Exámenes en el periodo', rows.length) +
      kpi('Pacientes', new Set(rows.map((r) => r.email)).size) +
      kpi('Fuera de rango', rows.length ? `${Math.round((abnormal / rows.length) * 100)}%` : '0%', { sub: `${abnormal} resultados`, tone: 'warn' });
    const p = paginate(rows, state.page, 10);
    state.page = p.page;
    $('#tbl', root).innerHTML = p.total === 0 ? '<p class="empty">No hay exámenes en ese rango.</p>' : `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Fecha</th><th>Paciente</th><th>Examen</th><th>Resultado</th><th>Estado</th><th>Registró</th></tr></thead>
        <tbody>${p.rows.map((r) => `<tr><td>${formatDate(r.date)}</td><td>${esc(r.userName)}</td><td>${esc(r.type)}</td><td><strong>${r.value}</strong> ${esc(r.unit)}</td>
          <td>${statusBadge({ Normal: 'normal', 'Límite': 'borderline', Alto: 'high', Bajo: 'low' }[r.status])}</td><td class="muted">${esc(r.staffName)}</td></tr>`).join('')}</tbody></table></div>`;
    renderPager($('#pager', root), p, (n) => { state.page = n; draw(); });
  };

  $('#from', root).addEventListener('change', (e) => { state.from = e.target.value; state.page = 1; draw(); });
  $('#to', root).addEventListener('change', (e) => { state.to = e.target.value; state.page = 1; draw(); });
  $$('[data-type]', root).forEach((c) => c.addEventListener('change', () => {
    c.checked ? state.types.add(c.dataset.type) : state.types.delete(c.dataset.type);
    state.page = 1;
    draw();
  }));
  $('#dl-csv', root).addEventListener('click', () => { if (validate()) downloadReportCSV(current(), state.from, state.to); });
  $('#dl-xlsx', root).addEventListener('click', () => { if (validate()) downloadReportXLSX(current(), state.from, state.to); });
  draw();
}
