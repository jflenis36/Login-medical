// Mini base de datos: data/db.json es la semilla; los cambios se guardan en localStorage
// (un navegador no puede escribir archivos del disco). Se puede exportar/importar el JSON.

const DB_KEY = 'loginMedical.db';
const SESSION_KEY = 'loginMedical.session';
const SEED_URL = 'data/db.json';

let state = { schema: 1, users: [], exams: [] };

const persist = () => localStorage.setItem(DB_KEY, JSON.stringify(state));

async function loadSeed() {
  const res = await fetch(SEED_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo leer ${SEED_URL} (${res.status})`);
  return res.json();
}

export async function initDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw);
      return;
    } catch { /* datos corruptos: se vuelve a la semilla */ }
  }
  await resetDB();
}

export async function resetDB() {
  state = await loadSeed();
  persist();
  localStorage.removeItem(SESSION_KEY);
}

export function exportDB() {
  return JSON.stringify(state, null, 2);
}

export function importDB(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.users) || !Array.isArray(data.exams)) throw new Error('El archivo no tiene el formato esperado (users, exams).');
  state = { schema: data.schema || 1, users: data.users, exams: data.exams };
  persist();
}

const nextId = (list, prefix, pad) => {
  const max = list.reduce((m, x) => Math.max(m, Number(x.id.split('-')[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
};

// ---- Usuarios ----
export const getUsers = () => state.users.map((u) => ({ ...u }));
export const getUser = (id) => state.users.find((u) => u.id === id) || null;
export const findUserByEmail = (email) => state.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase()) || null;

export function createUser(data) {
  const user = {
    id: nextId(state.users, 'u', 3),
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    role: data.role || 'client',
    sex: data.sex || 'O',
    document: (data.document || '').trim(),
    birthdate: data.birthdate || '',
    phone: (data.phone || '').trim(),
    active: data.active !== false,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  state.users.push(user);
  persist();
  return user;
}

export function updateUser(id, patch) {
  const user = getUser(id);
  if (!user) throw new Error('Usuario no encontrado');
  Object.assign(user, patch);
  if (user.email) user.email = user.email.trim().toLowerCase();
  persist();
  return user;
}

export const countActiveAdmins = () => state.users.filter((u) => u.role === 'admin' && u.active).length;

// ---- Exámenes ----
export const getExams = () => state.exams.map((e) => ({ ...e }));
export const getExamsByUser = (userId) => state.exams.filter((e) => e.userId === userId).map((e) => ({ ...e }));

export function addExam({ userId, type, value, date, staffId, notes }) {
  const exam = {
    id: nextId(state.exams, 'e', 4),
    userId, type,
    value: Number(value),
    date,
    staffId: staffId || null,
    notes: (notes || '').trim(),
  };
  state.exams.push(exam);
  persist();
  return exam;
}

// ---- Sesión ----
export const getSessionUserId = () => localStorage.getItem(SESSION_KEY);
export const setSession = (id) => localStorage.setItem(SESSION_KEY, id);
export const clearSession = () => localStorage.removeItem(SESSION_KEY);
