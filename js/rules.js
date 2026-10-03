// Reglas clínicas simples (valores de referencia orientativos para la demo).

export const ROLES = {
  admin: 'Administrador',
  staff: 'Atención',
  client: 'Cliente',
};

export const EXAM_TYPES = {
  glucose: { label: 'Glucosa', unit: 'mg/dL', hint: 'en ayunas', decimals: 0 },
  cholesterol: { label: 'Colesterol total', unit: 'mg/dL', hint: '', decimals: 0 },
  triglycerides: { label: 'Triglicéridos', unit: 'mg/dL', hint: '', decimals: 0 },
  hemoglobin: { label: 'Hemoglobina', unit: 'g/dL', hint: '', decimals: 1 },
};
export const EXAM_KEYS = Object.keys(EXAM_TYPES);

export const STATUS = {
  normal: { label: 'Normal', rank: 0 },
  borderline: { label: 'Límite', rank: 1 },
  low: { label: 'Bajo', rank: 2 },
  high: { label: 'Alto', rank: 2 },
  none: { label: 'Sin examen', rank: -1 },
};

export const SEX = { F: 'Femenino', M: 'Masculino', O: 'Otro / no especifica' };

// Rango normal [min, max] (null = sin límite) según tipo y sexo.
export function normalRange(type, sex) {
  switch (type) {
    case 'glucose': return [70, 99];
    case 'cholesterol': return [null, 199];
    case 'triglycerides': return [null, 149];
    case 'hemoglobin':
      if (sex === 'M') return [13.5, 17.5];
      if (sex === 'F') return [12.0, 15.5];
      return [12.0, 17.5];
    default: return [null, null];
  }
}

export function rangeText(type, sex) {
  const [min, max] = normalRange(type, sex);
  const u = EXAM_TYPES[type].unit;
  if (min != null && max != null) return `${min} - ${max} ${u}`;
  if (max != null) return `< ${max + 1} ${u}`;
  return `>= ${min} ${u}`;
}

export function evaluate(type, value, sex) {
  const v = Number(value);
  switch (type) {
    case 'glucose':
      if (v < 70) return 'low';
      if (v < 100) return 'normal';
      if (v < 126) return 'borderline';
      return 'high';
    case 'cholesterol':
      if (v < 200) return 'normal';
      if (v < 240) return 'borderline';
      return 'high';
    case 'triglycerides':
      if (v < 150) return 'normal';
      if (v < 200) return 'borderline';
      return 'high';
    case 'hemoglobin': {
      const [min, max] = normalRange(type, sex);
      if (v < min) return 'low';
      if (v > max) return 'high';
      return 'normal';
    }
    default: return 'normal';
  }
}

export function formatValue(type, value) {
  const d = EXAM_TYPES[type].decimals;
  return Number(value).toFixed(d);
}

// ---- Fechas (se manejan como 'YYYY-MM-DD') ----
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const formatDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '-');
export function monthsBetween(fromISO, toISO) {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  let m = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) m -= 1;
  return Math.max(0, m);
}

// Último examen de cada tipo para una lista de exámenes de un usuario.
export function latestByType(exams) {
  const res = {};
  for (const e of exams) {
    if (!res[e.type] || e.date > res[e.type].date || (e.date === res[e.type].date && e.id > res[e.type].id)) res[e.type] = e;
  }
  return res;
}

// Estado global de un paciente: el peor de sus últimos exámenes.
export function overallStatus(user, exams) {
  const latest = latestByType(exams);
  const keys = Object.keys(latest);
  if (!keys.length) return 'none';
  let worst = 'normal';
  for (const k of keys) {
    const s = evaluate(k, latest[k].value, user.sex);
    if (STATUS[s].rank > STATUS[worst].rank) worst = s;
  }
  return worst;
}

// "Qué necesita" el paciente: lista de recomendaciones ordenadas por urgencia.
// level: danger | warn | info
export function needsFor(user, exams, today = todayISO()) {
  const latest = latestByType(exams);
  const needs = [];
  for (const type of EXAM_KEYS) {
    const label = EXAM_TYPES[type].label;
    const last = latest[type];
    if (!last) {
      needs.push({ level: 'info', type, text: `Realizar examen de ${label.toLowerCase()} (aún no tiene)` });
      continue;
    }
    const status = evaluate(type, last.value, user.sex);
    const months = monthsBetween(last.date, today);
    const ago = months === 0 ? 'este mes' : `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    if (status === 'high' || status === 'low') {
      const dir = status === 'high' ? 'alta' : 'baja';
      needs.push({
        level: 'danger', type,
        text: `${label} ${dir} (${formatValue(type, last.value)} ${EXAM_TYPES[type].unit}): requiere valoración médica` + (months >= 3 ? ` y repetir el examen (último ${ago})` : ''),
      });
    } else if (status === 'borderline') {
      needs.push({
        level: 'warn', type,
        text: months >= 3
          ? `${label} en límite: repetir examen (último ${ago})`
          : `${label} en límite (${formatValue(type, last.value)} ${EXAM_TYPES[type].unit}): vigilar hábitos y repetir en 3 meses`,
      });
    } else if (months >= 12) {
      needs.push({ level: 'info', type, text: `Control anual de ${label.toLowerCase()} vencido (último ${ago})` });
    }
  }
  const order = { danger: 0, warn: 1, info: 2 };
  needs.sort((a, b) => order[a.level] - order[b.level]);
  return needs;
}

export const needsLevel = (needs) => (needs.some((n) => n.level === 'danger') ? 'danger' : needs.some((n) => n.level === 'warn') ? 'warn' : needs.length ? 'info' : 'ok');
