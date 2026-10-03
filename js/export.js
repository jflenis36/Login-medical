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
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s.replace(',', '.')))) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// CSV pensado para Excel en español: separador ";" y coma decimal, con BOM para las tildes.
export function downloadReportCSV(rows, from, to) {
  const toRow = (r) => rowToArray(r).map((v) => (typeof v === 'number' ? String(v).replace('.', ',') : v));
  const lines = [REPORT_HEADERS, ...rows.map(toRow)].map((r) => r.map(csvCell).join(';'));
  downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `reporte-examenes_${from}_${to}.csv`);
}

// ---------- Excel (.xlsx) con formato ----------
const XL = {
  brand: 'FF0F766E',
  line: 'FFD0D7DE',
  zebra: 'FFF6F8FA',
  status: {
    Normal: { fg: 'FF1A7F4B', bg: 'FFE3F5EA' },
    'Límite': { fg: 'FF8A5A00', bg: 'FFFDF0D2' },
    Alto: { fg: 'FFB3261E', bg: 'FFFBE4E2' },
    Bajo: { fg: 'FF1D4F91', bg: 'FFE1ECFA' },
  },
};
const border = { style: 'thin', color: { argb: XL.line } };
const allBorders = { top: border, left: border, bottom: border, right: border };
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function styleHeader(row) {
  row.height = 22;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(XL.brand);
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = allBorders;
  });
}

export async function downloadReportXLSX(rows, from, to) {
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'Login Medical';
  wb.created = new Date();

  // --- Hoja 1: Exámenes ---
  const ws = wb.addWorksheet('Exámenes', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  const widths = [12, 26, 14, 30, 12, 18, 12, 9, 20, 10, 22];
  ws.columns = widths.map((width) => ({ width }));
  ws.mergeCells(1, 1, 1, REPORT_HEADERS.length);
  const title = ws.getCell('A1');
  title.value = `Reporte de exámenes: ${formatDate(from)} al ${formatDate(to)}`;
  title.font = { bold: true, size: 14, color: { argb: XL.brand } };
  ws.getRow(1).height = 26;
  ws.getCell('A2').value = `${rows.length} resultados · generado el ${formatDate(todayISO())}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF667380' } };

  styleHeader(ws.addRow(REPORT_HEADERS));
  rows.forEach((r, i) => {
    const [, ...rest] = rowToArray(r);
    const [y, m, d] = r.date.split('-').map(Number);
    const row = ws.addRow([new Date(Date.UTC(y, m - 1, d)), ...rest]);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(7).numFmt = r.typeKey === 'hemoglobin' ? '0.0' : '0';
    row.getCell(7).font = { bold: true };
    [5, 8, 11].forEach((c) => { row.getCell(c).alignment = { horizontal: 'center' }; });
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = allBorders;
      if (i % 2) c.fill = fill(XL.zebra);
    });
    const st = XL.status[r.status];
    const sc = row.getCell(10);
    sc.font = { bold: true, color: { argb: st.fg } };
    sc.fill = fill(st.bg);
    sc.alignment = { horizontal: 'center' };
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: REPORT_HEADERS.length } };

  // --- Hoja 2: Resumen por examen ---
  const ws2 = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  ws2.columns = [22, 10, 10, 10, 10, 10, 12].map((width) => ({ width }));
  styleHeader(ws2.addRow(['Examen', 'Total', 'Normal', 'Límite', 'Alto', 'Bajo', 'Promedio']));
  for (const key of EXAM_KEYS) {
    const sub = rows.filter((r) => r.typeKey === key);
    const count = (label) => sub.filter((r) => r.status === label).length;
    const avg = sub.length ? sub.reduce((s, r) => s + r.value, 0) / sub.length : null;
    const row = ws2.addRow([EXAM_TYPES[key].label, sub.length, count('Normal'), count('Límite'), count('Alto'), count('Bajo'), avg]);
    row.getCell(7).numFmt = '0.0';
    row.eachCell((c, n) => { c.border = allBorders; if (n > 1) c.alignment = { horizontal: 'center' }; });
    row.getCell(1).font = { bold: true };
  }
  ['C', 'D', 'E', 'F'].forEach((col, i) => {
    const st = XL.status[['Normal', 'Límite', 'Alto', 'Bajo'][i]];
    for (let r = 2; r <= EXAM_KEYS.length + 1; r++) {
      const c = ws2.getCell(`${col}${r}`);
      c.font = { color: { argb: st.fg }, bold: true };
      c.fill = fill(st.bg);
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `reporte-examenes_${from}_${to}.xlsx`);
}
