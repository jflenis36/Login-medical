// Autenticación simple en el cliente (solo para la demo: las contraseñas se guardan en claro en el JSON).
import * as db from './db.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s) => EMAIL_RE.test(String(s).trim());

export function currentUser() {
  const id = db.getSessionUserId();
  const user = id ? db.getUser(id) : null;
  if (!user || !user.active) {
    if (id) db.clearSession();
    return null;
  }
  return user;
}

export function login(email, password) {
  const user = db.findUserByEmail(email);
  if (!user || user.password !== password) throw new Error('Correo o contraseña incorrectos.');
  if (!user.active) throw new Error('Tu usuario está desactivado. Contacta al administrador.');
  db.setSession(user.id);
  return user;
}

export const logout = () => db.clearSession();

// Registro público: siempre crea un usuario con rol "client".
export function register({ name, email, password, confirm, sex, document, birthdate }) {
  if (!name?.trim()) throw new Error('Escribe tu nombre completo.');
  if (!isEmail(email)) throw new Error('El correo no es válido.');
  if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
  if (db.findUserByEmail(email)) throw new Error('Ya existe un usuario con ese correo.');
  const user = db.createUser({ name, email, password, sex, document, birthdate, role: 'client' });
  db.setSession(user.id);
  return user;
}

export const homeFor = (user) => ({ admin: '#/admin', staff: '#/staff', client: '#/client' }[user.role]);
