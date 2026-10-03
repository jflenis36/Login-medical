import * as auth from '../auth.js';
import * as db from '../db.js';
import { $, $$, esc, toast } from '../ui.js';
import { SEX } from '../rules.js';

const DEMO = [
  { role: 'Administrador', email: 'admin@medical.test', password: 'Admin123!' },
  { role: 'Atención', email: 'staff@medical.test', password: 'Staff123!' },
  { role: 'Cliente', email: 'client@medical.test', password: 'Cliente123!' },
];

const brand = `<div class="auth-brand"><span class="logo" aria-hidden="true">+</span><h1>Login Medical</h1><p>Resultados de laboratorio: glucosa, colesterol, triglicéridos y hemoglobina.</p></div>`;

export function renderLogin(root) {
  root.innerHTML = `
    <section class="auth-wrap">
      ${brand}
      <div class="card auth-card">
        <h2>Iniciar sesión</h2>
        <form id="login-form" novalidate>
          <label class="field"><span>Correo</span><input type="email" name="email" autocomplete="username" required autofocus></label>
          <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
          <p class="form-error" role="alert" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">Entrar</button>
        </form>
        <p class="auth-alt">¿No tienes cuenta? <a href="#/register">Regístrate como cliente</a></p>
      </div>
      <div class="card demo-card">
        <h3>Usuarios de prueba</h3>
        <p class="muted">Toca uno para rellenar el formulario.</p>
        <div class="demo-list">
          ${DEMO.map((d, i) => `<button type="button" class="demo-item" data-demo="${i}"><strong>${esc(d.role)}</strong><span>${esc(d.email)}</span></button>`).join('')}
        </div>
        <button type="button" class="link-btn" id="reset-db">Restablecer datos de prueba</button>
      </div>
    </section>`;

  const form = $('#login-form', root);
  const err = $('.form-error', form);
  $$('[data-demo]', root).forEach((b) => b.addEventListener('click', () => {
    const d = DEMO[b.dataset.demo];
    form.email.value = d.email;
    form.password.value = d.password;
    form.password.focus();
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const user = auth.login(form.email.value, form.password.value);
      location.hash = auth.homeFor(user);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
  $('#reset-db', root).addEventListener('click', async () => {
    if (!confirm('Se borrarán los cambios locales y se cargarán de nuevo los datos de prueba. ¿Continuar?')) return;
    await db.resetDB();
    toast('Datos de prueba restablecidos.');
  });
}

export function renderRegister(root) {
  root.innerHTML = `
    <section class="auth-wrap">
      ${brand}
      <div class="card auth-card">
        <h2>Crear cuenta de cliente</h2>
        <form id="reg-form" novalidate>
          <label class="field"><span>Nombre completo</span><input name="name" autocomplete="name" required></label>
          <label class="field"><span>Correo</span><input type="email" name="email" autocomplete="email" required></label>
          <div class="grid-2">
            <label class="field"><span>Documento (opcional)</span><input name="document" inputmode="numeric"></label>
            <label class="field"><span>Fecha de nacimiento</span><input type="date" name="birthdate" max="${new Date().toISOString().slice(0, 10)}"></label>
          </div>
          <label class="field"><span>Sexo</span>
            <select name="sex">${Object.entries(SEX).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
            <small class="muted">Se usa para los valores de referencia de la hemoglobina.</small>
          </label>
          <div class="grid-2">
            <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="new-password" required minlength="6"></label>
            <label class="field"><span>Confirmar contraseña</span><input type="password" name="confirm" autocomplete="new-password" required></label>
          </div>
          <p class="form-error" role="alert" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">Registrarme</button>
        </form>
        <p class="auth-alt">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
      </div>
    </section>`;
  const form = $('#reg-form', root);
  const err = $('.form-error', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const f = Object.fromEntries(new FormData(form));
      const user = auth.register(f);
      toast(`Bienvenido/a, ${user.name}.`);
      location.hash = auth.homeFor(user);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
}
