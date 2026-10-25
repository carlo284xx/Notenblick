const { buildGradeSummary, overallAverage, calculateTargetScore, validateImportedSubjects, formatAverage, canonicalShare, normalizeAssessment, WEIGHT_OPTIONS, COURSEWORK_SHARE_OPTIONS, PERFORMANCE_TYPES } = window.NotenblickLogic;

const STORAGE_KEY = 'notenblick-state-v1';

const state = {
  subjects: [],
  selectedSubjectId: null,
  toastTimer: null,
};

const els = {
  subjectList: document.getElementById('subject-list'),
  overviewAverage: document.getElementById('overall-average'),
  subjectCount: document.getElementById('subject-count'),
  detailPanel: document.getElementById('detail-panel'),
  detailSubjectName: document.getElementById('detail-subject-name'),
  detailSubjectAverage: document.getElementById('detail-subject-average'),
  courseShareSelect: document.getElementById('course-share-select'),
  calculationExplanation: document.getElementById('calculation-explanation'),
  assessmentList: document.getElementById('assessment-list'),
  assessmentForm: document.getElementById('assessment-form'),
  assessmentId: document.getElementById('assessment-id'),
  assessmentName: document.getElementById('assessment-name'),
  assessmentDate: document.getElementById('assessment-date'),
  assessmentPoints: document.getElementById('assessment-points'),
  assessmentType: document.getElementById('assessment-type'),
  assessmentWeight: document.getElementById('assessment-weight'),
  cancelAssessmentEdit: document.getElementById('cancel-assessment-edit'),
  goalForm: document.getElementById('goal-form'),
  goalTarget: document.getElementById('goal-target'),
  goalType: document.getElementById('goal-type'),
  goalWeight: document.getElementById('goal-weight'),
  goalResult: document.getElementById('goal-result'),
  toast: document.getElementById('toast'),
  subjectModal: document.getElementById('subject-modal'),
  subjectForm: document.getElementById('subject-form'),
  subjectName: document.getElementById('subject-name'),
  subjectCourseShare: document.getElementById('subject-course-share'),
  deleteSubjectBtn: document.getElementById('delete-subject-btn'),
  importBtn: document.getElementById('import-btn'),
  importFile: document.getElementById('import-file'),
  exportBtn: document.getElementById('export-btn'),
  addSubjectBtn: document.getElementById('add-subject-btn'),
  closeSubjectModal: document.getElementById('close-subject-modal'),
  cancelSubjectModal: document.getElementById('cancel-subject-modal')
};

const byId = (id) => document.getElementById(id);

const saveState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
  } catch (error) {
    showToast('Die Daten konnten nicht lokal gespeichert werden. Bitte prüfe den Browser-Speicher oder den Datenschutzmodus.');
  }
};

const loadState = () => {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return [];
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((subject) => ({
      id: subject.id,
      name: String(subject.name || 'Neues Fach'),
      courseworkShare: canonicalShare(subject.courseworkShare),
      assessments: Array.isArray(subject.assessments) ? subject.assessments.map((assessment) => normalizeAssessment(assessment)) : [],
    }));
  } catch (error) {
    return [];
  }
};

const showToast = (message) => {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');

  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }

  state.toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 3200);
};

const makeSubjectCard = (subject) => {
  const result = buildGradeSummary(subject);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'subject-card';
  if (state.selectedSubjectId === subject.id) {
    card.classList.add('selected');
  }
  card.setAttribute('data-subject-id', subject.id);
  card.innerHTML = `
    <div class="subject-header">
      <h3 class="subject-name">${escapeHtml(subject.name)}</h3>
      <span class="subject-average">${result.finalAverage === null ? '–' : Number(result.finalAverage).toFixed(2).replace('.', ',')}</span>
    </div>
    <div class="subject-meta">
      ${result.finalAverage === null ? '<span class="subject-empty">Noch keine Bewertung</span>' : '<span>Fachnote</span>'}
    </div>
  `;

  card.addEventListener('click', () => selectSubject(subject.id));
  return card;
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const renderOverview = () => {
  const average = overallAverage(state.subjects);
  els.overviewAverage.textContent = average === null ? '–' : Number(average).toFixed(2).replace('.', ',') + ' Punkte';
  els.subjectCount.textContent = String(state.subjects.length);
};

const renderSubjectList = () => {
  els.subjectList.innerHTML = '';

  if (state.subjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Fächer angelegt. Füge dein erstes Fach hinzu.';
    els.subjectList.appendChild(empty);
    return;
  }

  state.subjects.forEach((subject) => {
    els.subjectList.appendChild(makeSubjectCard(subject));
  });
};

const renderDetail = () => {
  const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);

  if (!subject) {
    els.detailPanel.classList.add('hidden');
    return;
  }

  const grade = buildGradeSummary(subject);
  els.detailPanel.classList.remove('hidden');
  els.detailSubjectName.textContent = subject.name;
  els.detailSubjectAverage.textContent = grade.finalAverage === null ? 'Noch keine Bewertung' : `${Number(grade.finalAverage).toFixed(2).replace('.', ',')} Punkte`;
  els.courseShareSelect.value = String(grade.courseShare);
  els.calculationExplanation.textContent = grade.finalAverage === null
    ? 'Es gibt noch keine zählenden Leistungen in diesem Fach. Wenn nur eine Kategorie notenrelevant ist, wird der vorhandene Durchschnitt vorläufig angezeigt.'
    : `In dieser Fachansicht werden die Kursarbeiten und die sonstigen Leistungen getrennt gewichtet. ${grade.provisional ? 'Nur eine Kategorie hat zählende Noten, deshalb wird der vorhandene Durchschnitt vorläufig angezeigt.' : 'Der Fachschnitt berechnet sich aus dem gewichteten Durchschnitt der Kursarbeiten und dem der sonstigen Leistungen.'}`;

  renderAssessmentList(subject);
  renderGoalResult(subject);
};

const renderAssessmentList = (subject) => {
  const assessments = [...subject.assessments].sort((a, b) => new Date(b.date) - new Date(a.date));
  els.assessmentList.innerHTML = '';

  if (!assessments.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Leistungen erfasst.';
    els.assessmentList.appendChild(empty);
    return;
  }

  assessments.forEach((assessment) => {
    const item = document.createElement('div');
    item.className = 'assessment-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(assessment.name)}</strong>
        <small>${assessment.type} · ${formatDate(assessment.date)}</small>
      </div>
      <div>
        <strong>${Number(assessment.points).toFixed(2).replace('.', ',')}</strong>
        <small>Punkte</small>
      </div>
      <div>
        <strong>${assessment.type === 'Kursarbeit' ? 'Kursarbeit' : 'Sonstige'}</strong>
        <small>Art</small>
      </div>
      <div>
        <strong>${String(assessment.weight).replace('.', ',')}×</strong>
        <small>Gewicht</small>
      </div>
      <div class="assessment-actions">
        <button type="button" data-edit-id="${assessment.id}">Bearbeiten</button>
        <button type="button" data-delete-id="${assessment.id}">Löschen</button>
      </div>
    `;

    const editButton = item.querySelector('[data-edit-id]');
    const deleteButton = item.querySelector('[data-delete-id]');

    editButton.addEventListener('click', () => startAssessmentEdit(assessment));
    deleteButton.addEventListener('click', () => deleteAssessment(assessment.id));

    els.assessmentList.appendChild(item);
  });
};

const renderGoalResult = (subject) => {
  const target = Number(els.goalTarget.value);
  const selectedType = els.goalType.value;
  const weight = Number(els.goalWeight.value);

  if (!Number.isFinite(target) || target < 0 || target > 15) {
    els.goalResult.innerHTML = '<strong>Bitte geben Sie einen Zielwert zwischen 0 und 15 ein.</strong>';
    return;
  }

  const result = calculateTargetScore(subject, target, selectedType, weight);

  if (result.noInfluence) {
    els.goalResult.innerHTML = `
      <strong>Kein Einfluss:</strong> ${result.message}<br />
      <span>Aktueller Fachschnitt: ${result.resultAverage === null ? 'Noch keine Bewertung' : Number(result.resultAverage).toFixed(2).replace('.', ',')} Punkte</span>
    `;
    return;
  }

  if (result.requiredPoints === null) {
    els.goalResult.innerHTML = `
      <strong>${result.message}</strong><br />
      <span>Maximal erreichbarer Fachschnitt mit 15 Punkten: ${result.maxReachable === null ? '–' : Number(result.maxReachable).toFixed(2).replace('.', ',')} Punkte</span>
    `;
    return;
  }

  els.goalResult.innerHTML = `
    <strong>Mindestens benötigte Punktzahl:</strong> ${result.requiredPoints} Punkte<br />
    <strong>Ergebnis bei dieser Leistung:</strong> ${Number(result.resultAverage).toFixed(2).replace('.', ',')} Punkte<br />
    <strong>Maximal erreichbarer Fachschnitt mit 15 Punkten:</strong> ${result.maxReachable === null ? '–' : Number(result.maxReachable).toFixed(2).replace('.', ',')} Punkte
  `;
};

const formatDate = (raw) => {
  if (!raw) return 'Ohne Datum';
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const selectSubject = (subjectId) => {
  state.selectedSubjectId = subjectId;
  renderSubjectList();
  renderDetail();
};

const openSubjectModal = () => {
  els.subjectModal.classList.remove('hidden');
  els.subjectModal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => els.subjectName.focus(), 10);
};

const closeSubjectModal = () => {
  els.subjectModal.classList.add('hidden');
  els.subjectModal.setAttribute('aria-hidden', 'true');
  els.subjectForm.reset();
};

const openNewSubject = () => {
  els.subjectForm.dataset.mode = 'create';
  els.subjectName.value = '';
  els.subjectCourseShare.value = '0.333';
  openSubjectModal();
};

const updateSubjectCourseShare = (subjectId, value) => {
  const subject = state.subjects.find((item) => item.id === subjectId);
  if (!subject) return;
  subject.courseworkShare = canonicalShare(value);
  saveState();
  renderAll();
};

const renderAll = () => {
  renderOverview();
  renderSubjectList();
  renderDetail();
};

const addSubject = (event) => {
  event.preventDefault();
  const name = els.subjectName.value.trim();
  if (!name) {
    showToast('Bitte gib einen Fachnamen ein.');
    return;
  }

  const newSubject = {
    id: crypto.randomUUID ? crypto.randomUUID() : `subject-${Date.now()}`,
    name,
    courseworkShare: canonicalShare(els.subjectCourseShare.value),
    assessments: [],
  };

  state.subjects.push(newSubject);
  state.selectedSubjectId = newSubject.id;
  saveState();
  closeSubjectModal();
  renderAll();
  showToast('Fach wurde hinzugefügt.');
};

const deleteSubject = () => {
  const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
  if (!subject) return;

  const confirmed = window.confirm(`Das Fach „${subject.name}“ samt allen seinen Leistungen wird gelöscht. Fortfahren?`);
  if (!confirmed) return;

  state.subjects = state.subjects.filter((item) => item.id !== state.selectedSubjectId);
  state.selectedSubjectId = state.subjects[0]?.id || null;
  saveState();
  renderAll();
  showToast('Fach wurde gelöscht.');
};

const resetAssessmentForm = () => {
  els.assessmentId.value = '';
  els.assessmentForm.reset();
  els.assessmentType.value = 'Mündliche Note';
  els.assessmentWeight.value = '1';
  els.assessmentDate.value = new Date().toISOString().slice(0, 10);
  els.cancelAssessmentEdit.classList.add('hidden');
};

const startAssessmentEdit = (assessment) => {
  const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
  if (!subject) return;

  els.assessmentId.value = assessment.id;
  els.assessmentName.value = assessment.name;
  els.assessmentDate.value = assessment.date;
  els.assessmentPoints.value = assessment.points;
  els.assessmentType.value = assessment.type;
  els.assessmentWeight.value = String(assessment.weight);
  els.cancelAssessmentEdit.classList.remove('hidden');
  els.assessmentName.focus();
};

const saveAssessment = (event) => {
  event.preventDefault();
  const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
  if (!subject) return;

  const name = els.assessmentName.value.trim();
  const points = Number(els.assessmentPoints.value);
  const type = els.assessmentType.value;
  const weight = Number(els.assessmentWeight.value);
  const date = els.assessmentDate.value;

  if (!name || !date || Number.isNaN(points) || points < 0 || points > 15) {
    showToast('Bitte prüfe die Leistung: Name, Datum und Punktebereich sind erforderlich.');
    return;
  }

  const id = els.assessmentId.value || crypto.randomUUID ? (crypto.randomUUID ? crypto.randomUUID() : `assessment-${Date.now()}`) : `assessment-${Date.now()}`;
  const newAssessment = { id, name, date, type, points, weight };

  const existingIndex = subject.assessments.findIndex((item) => item.id === els.assessmentId.value);
  if (existingIndex >= 0) {
    subject.assessments[existingIndex] = newAssessment;
    showToast('Leistung wurde bearbeitet.');
  } else {
    subject.assessments.push(newAssessment);
    showToast('Leistung wurde hinzugefügt.');
  }

  saveState();
  resetAssessmentForm();
  renderAll();
};

const deleteAssessment = (assessmentId) => {
  const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
  if (!subject) return;

  const confirmed = window.confirm('Diese Leistung wirklich löschen?');
  if (!confirmed) return;

  subject.assessments = subject.assessments.filter((assessment) => assessment.id !== assessmentId);
  saveState();
  renderAll();
  showToast('Leistung wurde gelöscht.');
};

const exportData = () => {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), subjects: state.subjects }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'notenblick-export.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('JSON-Export wurde erstellt.');
};

const importData = async (file) => {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedSubjects = validateImportedSubjects(parsed);

    const confirmed = window.confirm('Damit werden alle vorhandenen Fächer ersetzt. Fortfahren?');
    if (!confirmed) return;

    state.subjects = importedSubjects;
    state.selectedSubjectId = importedSubjects[0]?.id || null;
    saveState();
    renderAll();
    showToast('Daten wurden erfolgreich importiert.');
  } catch (error) {
    showToast(error.message || 'Die importierte Datei konnte nicht verarbeitet werden.');
  }
};

const handleGoalFormSubmit = (event) => {
  event.preventDefault();
  const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
  if (!subject) return;
  renderGoalResult(subject);
};

const bindEvents = () => {
  els.addSubjectBtn.addEventListener('click', openNewSubject);
  els.closeSubjectModal.addEventListener('click', closeSubjectModal);
  els.cancelSubjectModal.addEventListener('click', closeSubjectModal);
  els.subjectForm.addEventListener('submit', addSubject);
  els.deleteSubjectBtn.addEventListener('click', deleteSubject);
  els.courseShareSelect.addEventListener('change', (event) => updateSubjectCourseShare(state.selectedSubjectId, event.target.value));
  els.assessmentForm.addEventListener('submit', saveAssessment);
  els.cancelAssessmentEdit.addEventListener('click', resetAssessmentForm);
  els.goalForm.addEventListener('submit', handleGoalFormSubmit);
  els.goalTarget.addEventListener('input', () => {
    const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
    if (subject) renderGoalResult(subject);
  });
  els.goalType.addEventListener('change', () => {
    const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
    if (subject) renderGoalResult(subject);
  });
  els.goalWeight.addEventListener('change', () => {
    const subject = state.subjects.find((item) => item.id === state.selectedSubjectId);
    if (subject) renderGoalResult(subject);
  });
  els.exportBtn.addEventListener('click', exportData);
  els.importBtn.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    importData(file);
    event.target.value = '';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.subjectModal.classList.contains('hidden')) {
      closeSubjectModal();
    }
  });
};

const init = () => {
  state.subjects = loadState();
  state.selectedSubjectId = state.subjects[0]?.id || null;

  els.assessmentDate.value = new Date().toISOString().slice(0, 10);
  els.goalTarget.value = '12';
  els.goalWeight.value = '1';

  bindEvents();
  renderAll();
};

init();
