import * as db from './db.js';
import { currentUser, logout, homeFor } from './auth.js';
import { ROLES } from './rules.js';
import { $, esc, destroyCharts, initials } from './ui.js';
import { renderLogin, renderRegister } from './views/auth.js';
import { renderAdmin } from './views/admin.js';
import { renderStaffHome, renderStaffClient, renderStaffReports } from './views/staff.js';
import { renderClient } from './views/client.js';

const app = $('#app');

const NAV = {
  admin: [['#/admin', 'Usuarios y roles']],
  staff: [['#/staff', 'Pacientes'], ['#/staff/reports', 'Reportes']],
  client: [['#/client', 'Mis exámenes']],
};

// Cada ruta indica qué rol puede verla (null = pública)
const ROUTES = [
  { re: /^#\/login$/, role: null, view: (root) => renderLogin(root) },
  { re: /^#\/register$/, role: null, view: (root) => renderRegister(root) },
  { re: /^#\/admin$/, role: 'admin', view: (root, me) => renderAdmin(root, me) },
  { re: /^#\/staff$/, role: 'staff', view: (root) => renderStaffHome(root) },
  { re: /^#\/staff\/reports$/, role: 'staff', view: (root) => renderStaffReports(root) },
  { re: /^#\/staff\/client\/([\w-]+)$/, role: 'staff', view: (root, me, m) => renderStaffClient(root, me, m[1]) },
  { re: /^#\/client$/, role: 'client', view: (root, me) => renderClient(root, me) },
];

function shell(me, hash) {
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="${homeFor(me)}"><span class="logo sm" aria-hidden="true">+</span> Login Medical</a>
        <nav class="nav" aria-label="Principal">
          ${NAV[me.role].map(([href, label]) => `<a href="${href}" ${hash === href || (href === '#/staff' && hash.startsWith('#/staff/client')) ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
        </nav>
        <div class="userbox">
          <span class="avatar" aria-hidden="true">${esc(initials(me.name))}</span>
          <div class="userbox-text"><strong>${esc(me.name)}</strong><span class="muted">${esc(ROLES[me.role])}</span></div>
          <button class="btn btn-ghost btn-sm" id="logout">Salir</button>
        </div>
      </div>
    </header>
    <main class="container" id="view"></main>`;
}

function route() {
  destroyCharts();
  const hash = location.hash || '#/login';
  const me = currentUser();
  const match = ROUTES.map((r) => ({ r, m: hash.match(r.re) })).find((x) => x.m);

  if (!match) { location.replace(me ? homeFor(me) : '#/login'); return; }
  const { r, m } = match;

  if (r.role === null) {
    if (me) { location.replace(homeFor(me)); return; } // ya hay sesión
    app.innerHTML = '<main class="container" id="view"></main>';
    r.view($('#view'), null, m);
    return;
  }
  if (!me) { location.replace('#/login'); return; }
  if (me.role !== r.role) { location.replace(homeFor(me)); return; }

  app.innerHTML = shell(me, hash);
  $('#logout').addEventListener('click', () => { logout(); location.hash = '#/login'; });
  r.view($('#view'), me, m);
  window.scrollTo(0, 0);
}

async function start() {
  try {
    await db.initDB();
  } catch (err) {
    app.innerHTML = `
      <main class="container"><div class="card auth-card">
        <h2>No se pudieron cargar los datos</h2>
        <p>${esc(err.message)}</p>
        <p class="muted">Abre la app con un servidor local (el navegador no permite leer <code>data/db.json</code> desde <code>file://</code>):</p>
        <pre class="code">python3 -m http.server 8080
# luego abre http://localhost:8080</pre>
      </div></main>`;
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

start();
