// Genera data/db.json con usuarios y exámenes de prueba.
// Uso: node tools/generate-seed.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../data/db.json');

// PRNG determinista para que el seed sea reproducible
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261003);
const jitter = (v, pct) => v * (1 + (rnd() * 2 - 1) * pct);

const users = [
  { id: 'u-001', name: 'Ana Administradora', email: 'admin@medical.test', password: 'Admin123!', role: 'admin', sex: 'F', document: '1000000001', birthdate: '1985-04-12', phone: '3000000001', active: true, createdAt: '2025-06-01' },
  { id: 'u-002', name: 'Sofía Atención', email: 'staff@medical.test', password: 'Staff123!', role: 'staff', sex: 'F', document: '1000000002', birthdate: '1990-08-23', phone: '3000000002', active: true, createdAt: '2025-06-01' },
  { id: 'u-003', name: 'Carlos Méndez', email: 'carlos.mendez@medical.test', password: 'Staff123!', role: 'staff', sex: 'M', document: '1000000003', birthdate: '1988-01-30', phone: '3000000003', active: true, createdAt: '2025-06-01' },
];

// base: valor central por examen; types: exámenes que se realizó; dates: sesiones
const clients = [
  { name: 'Laura Gómez', email: 'client@medical.test', sex: 'F', born: '1992-03-15', base: { glucose: 92, cholesterol: 205, triglycerides: 130, hemoglobin: 13.2 }, dates: ['2025-11-12', '2026-03-20', '2026-09-18'] },
  { name: 'Andrés Ramírez', sex: 'M', born: '1987-07-02', base: { glucose: 88, cholesterol: 175, triglycerides: 110, hemoglobin: 15.1 }, dates: ['2026-02-10', '2026-09-05'] },
  { name: 'Valentina Torres', sex: 'F', born: '1995-11-28', base: { glucose: 85, cholesterol: 168, triglycerides: 95, hemoglobin: 13.6 }, dates: ['2026-05-14', '2026-09-22'] },
  { name: 'Miguel Herrera', sex: 'M', born: '1979-02-09', base: { glucose: 112, cholesterol: 198, triglycerides: 160, hemoglobin: 15.4 }, dates: ['2025-12-02', '2026-04-15', '2026-09-10'], drift: { glucose: 1.04 } },
  { name: 'Camila Rojas', sex: 'F', born: '1968-09-17', base: { glucose: 142, cholesterol: 232, triglycerides: 185, hemoglobin: 12.8 }, dates: ['2026-01-20', '2026-07-08', '2026-09-25'] },
  { name: 'Jorge Castillo', sex: 'M', born: '1974-05-21', base: { glucose: 97, cholesterol: 252, triglycerides: 235, hemoglobin: 16.0 }, dates: ['2026-03-11', '2026-09-14'] },
  { name: 'Daniela Moreno', sex: 'F', born: '1999-12-05', base: { glucose: 82, cholesterol: 150, triglycerides: 88, hemoglobin: 10.4 }, dates: ['2026-04-02', '2026-09-27'] },
  { name: 'Felipe Vargas', sex: 'M', born: '2001-06-30', base: { glucose: 90, cholesterol: 160, triglycerides: 100, hemoglobin: 12.9 }, dates: ['2026-08-19'] },
  { name: 'Ricardo Salazar', sex: 'M', born: '1965-10-11', base: { glucose: 129, cholesterol: 228, triglycerides: 268, hemoglobin: 14.6 }, dates: ['2025-10-28', '2026-05-06', '2026-09-30'] },
  { name: 'Isabela Mejía', sex: 'F', born: '1983-01-19', base: { glucose: 94, cholesterol: 182 }, types: ['glucose', 'cholesterol'], dates: ['2026-06-17'] },
  { name: 'Pablo Navarro', sex: 'M', born: '1971-03-08', base: { glucose: 96 }, types: ['glucose'], dates: ['2025-10-09'] },
  { name: 'Natalia Pardo', sex: 'F', born: '2003-08-14', base: {}, dates: [] },
  { name: 'Héctor Duarte', sex: 'M', born: '1958-04-25', base: { glucose: 91, cholesterol: 185, triglycerides: 120, hemoglobin: 14.8 }, dates: ['2025-08-22'] },
  { name: 'Mariana Ortiz', sex: 'F', born: '1990-07-07', base: { glucose: 87, cholesterol: 172, triglycerides: 92, hemoglobin: 13.0 }, dates: ['2026-07-01', '2026-09-29'] },
  { name: 'Sebastián León', sex: 'M', born: '1984-12-22', base: { glucose: 100, cholesterol: 195, triglycerides: 176, hemoglobin: 14.9 }, dates: ['2026-02-27', '2026-08-30'] },
  { name: 'Juliana Peña', sex: 'F', born: '1977-05-03', base: { glucose: 89, cholesterol: 210, triglycerides: 145, hemoglobin: 14.0 }, dates: ['2026-03-30', '2026-09-12'] },
  { name: 'Tomás Aguilar', sex: 'M', born: '1993-10-16', base: { glucose: 86, cholesterol: 180, triglycerides: 115, hemoglobin: 18.1 }, dates: ['2026-05-25', '2026-09-08'] },
  { name: 'Lucía Fernández', sex: 'F', born: '1996-02-01', base: { glucose: 64, cholesterol: 155, triglycerides: 80, hemoglobin: 12.6 }, dates: ['2026-06-09', '2026-09-20'] },
  { name: 'Gabriela Silva', sex: 'F', born: '1972-11-11', base: { glucose: 84, cholesterol: 170, triglycerides: 105, hemoglobin: 13.8 }, dates: ['2026-04-21', '2026-09-03'] },
  { name: 'Diego Cárdenas', sex: 'M', born: '1989-09-09', base: { glucose: 103, cholesterol: 190, triglycerides: 138, hemoglobin: 15.2 }, dates: ['2026-01-13', '2026-07-22', '2026-09-26'] },
];

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');
const staffIds = ['u-002', 'u-003'];
const exams = [];
let examSeq = 1;

clients.forEach((c, i) => {
  const id = `u-${String(i + 4).padStart(3, '0')}`;
  const firstDate = c.dates[0] || '2026-09-01';
  users.push({
    id,
    name: c.name,
    email: c.email || `${normalize(c.name)}@correo.test`,
    password: 'Cliente123!',
    role: 'client',
    sex: c.sex,
    document: String(1010000000 + i * 137),
    birthdate: c.born,
    phone: `31${String(10000000 + i * 91357).slice(0, 8)}`,
    active: true,
    createdAt: firstDate,
  });
  const types = c.types || ['glucose', 'cholesterol', 'triglycerides', 'hemoglobin'];
  c.dates.forEach((date, n) => {
    types.forEach((type) => {
      let v = jitter(c.base[type], type === 'hemoglobin' ? 0.04 : 0.06);
      if (c.drift?.[type]) v *= Math.pow(c.drift[type], n - (c.dates.length - 1)); // tendencia: el último es el valor "base"
      v = type === 'hemoglobin' ? Math.round(v * 10) / 10 : Math.round(v);
      exams.push({
        id: `e-${String(examSeq++).padStart(4, '0')}`,
        userId: id,
        type,
        value: v,
        date,
        staffId: staffIds[Math.floor(rnd() * staffIds.length)],
        notes: '',
      });
    });
  });
});

exams.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ schema: 1, users, exams }, null, 2) + '\n');
console.log(`OK: ${users.length} usuarios, ${exams.length} exámenes -> ${out}`);
