import * as db from '../db.js';
import { isEmail } from '../auth.js';
import { ROLES, SEX, EXAM_TYPES, EXAM_KEYS, formatDate, evaluate, latestByType } from '../rules.js';
import { $, $$, esc, toast, openModal, paginate, renderPager, roleBadge, initials, makeChart, destroyCharts, COLORS, downloadBlob } from '../ui.js';
import { kpi } from './shared.js';

const PAGE_SIZE = 8;

export function renderAdmin(root, me) {
  const state = { q: '', role: '', page: 1 };

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Administración</h2><p class="muted">Gestiona usuarios y roles del sistema.</p></div>
      <button class="btn btn-primary" id="new-user">+ Nuevo usuario</button>
    </div>
    <div class="kpi-row" id="kpis"></div>
    <div class="grid-charts">
      <section class="card"><h3>Usuarios por rol</h3><div class="chart-box sm"><canvas id="ch-roles" role="img" aria-label="Usuarios por rol"></canvas></div></section>
      <section class="card"><h3>Exámenes por tipo</h3><div class="chart-box sm"><canvas id="ch-types" role="img" aria-label="Exámenes por tipo"></canvas></div></section>
      <section class="card"><h3>Exámenes por mes</h3><div class="chart-box sm"><canvas id="ch-months" role="img" aria-label="Exámenes por mes"></canvas></div></section>
    </div>
    <section class="card">
      <div class="card-head"><h3>Usuarios</h3>
        <div class="filters">
          <input type="search" id="q" placeholder="Buscar por nombre, correo o documento" aria-label="Buscar usuarios">
          <select id="role-filter" aria-label="Filtrar por rol"><option value="">Todos los roles</option>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        </div>
      </div>
      <div id="users-table"></div>
      <div class="pager" id="users-pager"></div>
    </section>
    <section class="card">
      <h3>Base de datos local</h3>
      <p class="muted">Los datos viven en este navegador (parten de <code>data/db.json</code>). Puedes descargar una copia, cargar otra o volver a los datos de prueba.</p>
      <div class="btn-row">
        <button class="btn btn-ghost" id="db-export">Descargar db.json</button>
        <label class="btn btn-ghost file-btn">Cargar db.json<input type="file" id="db-import" accept="application/json,.json" hidden></label>
        <button class="btn btn-danger-ghost" id="db-reset">Restablecer datos de prueba</button>
      </div>
    </section>`;

  const drawKpis = () => {
    const users = db.getUsers();
    const exams = db.getExams();
    const by = (r) => users.filter((u) => u.role === r).length;
    const usersById = new Map(users.map((u) => [u.id, u]));
    let out = 0, total = 0;
    for (const u of users.filter((x) => x.role === 'client')) {
      const latest = latestByType(exams.filter((e) => e.userId === u.id));
      for (const [type, e] of Object.entries(latest)) {
        total++;
        if (['high', 'low'].includes(evaluate(type, e.value, u.sex))) out++;
      }
    }
    $('#kpis', root).innerHTML =
      kpi('Usuarios', users.length, { sub: `${users.filter((u) => u.active).length} activos` }) +
      kpi('Clientes', by('client')) +
      kpi('Personal de atención', by('staff')) +
      kpi('Administradores', by('admin')) +
      kpi('Exámenes registrados', exams.length) +
      kpi('Resultados fuera de rango', total ? `${Math.round((out / total) * 100)}%` : '0%', { sub: 'último examen de cada cliente', tone: 'warn' });
    return { users, exams, usersById };
  };

  const drawCharts = ({ users, exams }) => {
    makeChart($('#ch-roles', root), {
      type: 'doughnut',
      data: { labels: Object.values(ROLES), datasets: [{ data: Object.keys(ROLES).map((r) => users.filter((u) => u.role === r).length), backgroundColor: ['#5b2a91', '#2563a8', '#0f766e'], borderWidth: 0 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } },
    });
    makeChart($('#ch-types', root), {
      type: 'bar',
      data: { labels: EXAM_KEYS.map((k) => EXAM_TYPES[k].label), datasets: [{ label: 'Exámenes', data: EXAM_KEYS.map((k) => exams.filter((e) => e.type === k).length), backgroundColor: COLORS.teal, borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } },
    });
    const months = [...new Set(exams.map((e) => e.date.slice(0, 7)))].sort().slice(-12);
    makeChart($('#ch-months', root), {
      type: 'line',
      data: { labels: months.map((m) => m.split('-').reverse().join('/')), datasets: [{ label: 'Exámenes', data: months.map((m) => exams.filter((e) => e.date.startsWith(m)).length), borderColor: COLORS.teal, backgroundColor: COLORS.tealSoft, fill: true, tension: 0.3, pointRadius: 3 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } },
    });
  };

  const drawTable = () => {
    const q = state.q.trim().toLowerCase();
    const list = db.getUsers()
      .filter((u) => (!state.role || u.role === state.role) && (!q || [u.name, u.email, u.document].some((v) => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const p = paginate(list, state.page, PAGE_SIZE);
    state.page = p.page;
    $('#users-table', root).innerHTML = p.total === 0 ? '<p class="empty">No hay usuarios con ese filtro.</p>' : `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Documento</th><th>Estado</th><th>Registro</th><th class="col-actions">Acciones</th></tr></thead>
        <tbody>${p.rows.map((u) => `<tr>
          <td><div class="person"><span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong><br><span class="muted">${esc(u.email)}</span></div></div></td>
          <td>${roleBadge(u.role)}</td>
          <td>${esc(u.document || '-')}</td>
          <td>${u.active ? '<span class="badge st-normal">Activo</span>' : '<span class="badge st-none">Inactivo</span>'}</td>
          <td>${formatDate(u.createdAt)}</td>
          <td class="col-actions"><button class="btn btn-ghost btn-sm" data-edit="${esc(u.id)}">Editar</button></td>
        </tr>`).join('')}</tbody></table></div>`;
    renderPager($('#users-pager', root), p, (n) => { state.page = n; drawTable(); });
    $$('[data-edit]', root).forEach((b) => b.addEventListener('click', () => openUserModal(db.getUser(b.dataset.edit))));
  };

  const refresh = () => {
    const data = drawKpis();
    destroyCharts();
    drawCharts(data);
    drawTable();
  };

  function openUserModal(user) {
    const isNew = !user;
    const isSelf = user?.id === me.id;
    const u = user || { name: '', email: '', role: 'client', sex: 'O', document: '', birthdate: '', phone: '', active: true };
    openModal({
      title: isNew ? 'Nuevo usuario' : `Editar usuario`,
      submitText: isNew ? 'Crear usuario' : 'Guardar cambios',
      body: `
        <label class="field"><span>Nombre completo</span><input name="name" value="${esc(u.name)}" required></label>
        <label class="field"><span>Correo</span><input type="email" name="email" value="${esc(u.email)}" required></label>
        <div class="grid-2">
          <label class="field"><span>Rol</span>
            <select name="role" ${isSelf ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
            ${isSelf ? '<small class="muted">No puedes cambiar tu propio rol.</small>' : ''}
          </label>
          <label class="field"><span>Contraseña ${isNew ? '' : '(opcional)'}</span><input type="password" name="password" autocomplete="new-password" ${isNew ? 'required' : 'placeholder="Dejar vacío para no cambiarla"'}></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Documento</span><input name="document" value="${esc(u.document)}"></label>
          <label class="field"><span>Teléfono</span><input name="phone" value="${esc(u.phone)}"></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Fecha de nacimiento</span><input type="date" name="birthdate" value="${esc(u.birthdate)}"></label>
          <label class="field"><span>Sexo</span><select name="sex">${Object.entries(SEX).map(([k, v]) => `<option value="${k}" ${u.sex === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        </div>
        <label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} ${isSelf ? 'disabled' : ''}> Usuario activo (puede iniciar sesión)</label>`,
      onSubmit(form) {
        const f = form.elements;
        const name = f.name.value.trim();
        const email = f.email.value.trim();
        if (!name) throw new Error('El nombre es obligatorio.');
        if (!isEmail(email)) throw new Error('El correo no es válido.');
        const dup = db.findUserByEmail(email);
        if (dup && dup.id !== user?.id) throw new Error('Ya existe otro usuario con ese correo.');
        const password = f.password.value;
        if (isNew && password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
        if (!isNew && password && password.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        const role = isSelf ? u.role : f.role.value;
        const active = isSelf ? true : f.active.checked;
        if (!isNew && u.role === 'admin' && (role !== 'admin' || !active) && db.countActiveAdmins() <= 1) {
          throw new Error('Debe quedar al menos un administrador activo.');
        }
        const data = { name, email, role, active, sex: f.sex.value, document: f.document.value, phone: f.phone.value, birthdate: f.birthdate.value };
        if (isNew) db.createUser({ ...data, password });
        else db.updateUser(user.id, { ...data, ...(password ? { password } : {}) });
        toast(isNew ? 'Usuario creado.' : 'Usuario actualizado.');
        refresh();
      },
    });
  }

  $('#new-user', root).addEventListener('click', () => openUserModal(null));
  $('#q', root).addEventListener('input', (e) => { state.q = e.target.value; state.page = 1; drawTable(); });
  $('#role-filter', root).addEventListener('change', (e) => { state.role = e.target.value; state.page = 1; drawTable(); });

  $('#db-export', root).addEventListener('click', () => {
    downloadBlob(new Blob([db.exportDB()], { type: 'application/json' }), 'db.json');
  });
  $('#db-import', root).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      db.importDB(await file.text());
      toast('Base de datos cargada. Inicia sesión de nuevo si tu usuario ya no existe.');
      location.reload();
    } catch (ex) {
      toast(`No se pudo cargar: ${ex.message}`, 'error');
    }
  });
  $('#db-reset', root).addEventListener('click', async () => {
    if (!confirm('Se perderán los cambios locales y volverán los datos de prueba. ¿Continuar?')) return;
    await db.resetDB();
    location.hash = '#/login';
    location.reload();
  });

  refresh();
}
