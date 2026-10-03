// Exportaciones: PDF individual (jsPDF + autoTable) y reporte general CSV / Excel (SheetJS).
import { EXAM_TYPES, EXAM_KEYS, SEX, evaluate, formatValue, rangeText, formatDate, STATUS, needsFor, todayISO } from './rules.js';
import { downloadBlob, slug } from './ui.js';

// ---------- PDF ----------
const STATUS_RGB = { normal: [26, 127, 75], borderline: [194, 138, 27], high: [192, 57, 43], low: [37, 99, 168] };

// exams: lista de exámenes del paciente (uno o varios).
export function downloadPatientPDF(user, exams, { title = 'Informe de exámenes de laboratorio', suffix = 'examenes', allExams = exams } = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, W, 64, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold').setFontSize(18).text('Login Medical', 40, 30);
  doc.setFont('helvetica', 'normal').setFontSize(11).text(title, 40, 48);
  doc.text(`Generado: ${formatDate(todayISO())}`, W - 40, 48, { align: 'right' });

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold').setFontSize(13).text('Datos del paciente', 40, 96);
  doc.setFont('helvetica', 'normal').setFontSize(11);
  const info = [
    ['Nombre', user.name],
    ['Documento', user.document || '-'],
    ['Sexo', SEX[user.sex] || '-'],
    ['Nacimiento', formatDate(user.birthdate)],
    ['Correo', user.email],
  ];
  info.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    doc.setFont('helvetica', 'bold').text(`${k}:`, 40 + col * 260, 116 + row * 18);
    doc.setFont('helvetica', 'normal').text(String(v), 110 + col * 260, 116 + row * 18);
  });

  const sorted = [...exams].sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
  doc.autoTable({
    startY: 176,
    head: [['Fecha', 'Examen', 'Resultado', 'Valor de referencia', 'Estado']],
    body: sorted.map((e) => {
      const st = evaluate(e.type, e.value, user.sex);
      return [formatDate(e.date), EXAM_TYPES[e.type].label, `${formatValue(e.type, e.value)} ${EXAM_TYPES[e.type].unit}`, rangeText(e.type, user.sex), STATUS[st].label];
    }),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 10 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const st = evaluate(sorted[data.row.index].type, sorted[data.row.index].value, user.sex);
        data.cell.styles.textColor = STATUS_RGB[st];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const needs = needsFor(user, allExams);
  let y = doc.lastAutoTable.finalY + 28;
  if (needs.length) {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(30).text('Recomendaciones', 40, y);
    doc.setFont('helvetica', 'normal').setFontSize(10);
    needs.forEach((n) => {
      const lines = doc.splitTextToSize(`- ${n.text}`, W - 80);
      y += 18;
      if (y > 780) { doc.addPage(); y = 50; }
      doc.text(lines, 40, y);
      y += (lines.length - 1) * 12;
    });
  }
  doc.setFontSize(8).setTextColor(120);
  doc.text('Documento informativo generado automáticamente. No reemplaza la valoración de un profesional de la salud.', 40, doc.internal.pageSize.getHeight() - 24);

  doc.save(`${suffix}-${slug(user.name)}-${todayISO()}.pdf`);
}

// ---------- Reporte general ----------
// rows: [{ date, userName, document, email, sex, type, value, unit, reference, status, staffName }]
const REPORT_HEADERS = ['Fecha', 'Paciente', 'Documento', 'Correo', 'Sexo', 'Examen', 'Resultado', 'Unidad', 'Valor de referencia', 'Estado', 'Registrado por'];
const rowToArray = (r) => [formatDate(r.date), r.userName, r.document, r.email, r.sex, r.type, r.value, r.unit, r.reference, r.status, r.staffName];

export function buildReportRows(exams, usersById) {
  return exams
    .map((e) => {
      const u = usersById.get(e.userId);
      if (!u) return null;
      return {
        date: e.date,
        userName: u.name,
        document: u.document || '',
        email: u.email,
        sex: SEX[u.sex] || '',
        type: EXAM_TYPES[e.type].label,
        typeKey: e.type,
        value: Number(formatValue(e.type, e.value)),
        unit: EXAM_TYPES[e.type].unit,
        reference: rangeText(e.type, u.sex),
        status: STATUS[evaluate(e.type, e.value, u.sex)].label,
        staffName: usersById.get(e.staffId)?.name || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName));
}

const csvCell = (v) => {
  let s = String(v ?? '');
  // Evita inyección de fórmulas al abrir el CSV en Excel
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadReportCSV(rows, from, to) {
  const lines = [REPORT_HEADERS, ...rows.map(rowToArray)].map((r) => r.map(csvCell).join(','));
  // BOM para que Excel respete las tildes
  downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `reporte-examenes_${from}_${to}.csv`);
}

export function downloadReportXLSX(rows, from, to) {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([REPORT_HEADERS, ...rows.map(rowToArray)]);
  ws['!cols'] = [12, 26, 14, 30, 12, 18, 11, 8, 20, 10, 22].map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: `A1:K${rows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, ws, 'Exámenes');

  // Hoja de resumen por tipo de examen
  const summary = [['Examen', 'Total', 'Normal', 'Límite', 'Alto', 'Bajo', 'Promedio']];
  for (const key of EXAM_KEYS) {
    const sub = rows.filter((r) => r.typeKey === key);
    const count = (label) => sub.filter((r) => r.status === label).length;
    const avg = sub.length ? Math.round((sub.reduce((s, r) => s + r.value, 0) / sub.length) * 10) / 10 : 0;
    summary.push([EXAM_TYPES[key].label, sub.length, count('Normal'), count('Límite'), count('Alto'), count('Bajo'), avg]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(summary);
  ws2['!cols'] = [20, 8, 8, 8, 8, 8, 10].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  XLSX.writeFile(wb, `reporte-examenes_${from}_${to}.xlsx`);
}
