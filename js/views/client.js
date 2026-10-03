import * as db from '../db.js';
import { EXAM_TYPES, needsFor } from '../rules.js';
import { $, $$, toast, esc } from '../ui.js';
import { needsList, examsTable, mountEvolution, latestCards } from './shared.js';
import { downloadPatientPDF } from '../export.js';

export function renderClient(root, me) {
  const exams = db.getExamsByUser(me.id);
  const needs = needsFor(me, exams);

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Hola, ${esc(me.name.split(' ')[0])}</h2><p class="muted">Estos son tus exámenes de laboratorio.</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="mail" title="Próximamente">Enviar por correo (próximamente)</button>
        <button class="btn btn-primary" id="pdf-all" ${exams.length ? '' : 'disabled'}>Descargar todo en PDF</button>
      </div>
    </div>
    ${latestCards(me, exams)}
    <div class="grid-2-1">
      <section class="card" id="evo"></section>
      <section class="card"><h3>Qué necesitas</h3>${needsList(needs, 'Todo en orden: no tienes pendientes.')}</section>
    </div>
    <section class="card"><h3>Mis exámenes</h3>${examsTable(me, exams, { pdf: true })}</section>`;

  mountEvolution($('#evo', root), me, exams);
  $('#pdf-all', root).addEventListener('click', () => downloadPatientPDF(me, exams));
  $('#mail', root).addEventListener('click', () => toast('El envío por correo estará disponible más adelante.', 'info'));
  $$('[data-exam-pdf]', root).forEach((b) => b.addEventListener('click', () => {
    const e = exams.find((x) => x.id === b.dataset.examPdf);
    downloadPatientPDF(me, [e], { title: `Resultado de ${EXAM_TYPES[e.type].label}`, suffix: e.type, allExams: exams });
  }));
}
