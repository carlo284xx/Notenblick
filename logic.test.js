const assert = require('node:assert/strict');
const { buildGradeSummary, overallAverage, calculateTargetScore, validateImportedSubjects, canonicalShare } = require('./logic.js');

const makeSubject = (overrides = {}) => ({
  id: 'subject-1',
  name: 'Mathe',
  courseworkShare: 0.333,
  assessments: [],
  ...overrides,
});

// 1. Einzelgewichte und 0-fache Noten
{
  const subject = makeSubject({
    assessments: [
      { id: 'a1', name: 'M1', type: 'Mündliche Note', points: 10, weight: 1 },
      { id: 'a2', name: 'M2', type: 'Mündliche Note', points: 11, weight: 0.5 },
      { id: 'a3', name: 'M3', type: 'Mündliche Note', points: 12, weight: 0 },
      { id: 'a4', name: 'K1', type: 'Kursarbeit', points: 13, weight: 1 },
    ],
  });

  const grade = buildGradeSummary(subject);
  assert.equal(Number(grade.otherAverage.toFixed(2)), 10.5);
  assert.equal(Number(grade.courseAverage.toFixed(2)), 13);
  assert.equal(Number(grade.finalAverage.toFixed(2)), 12.17);
}

// 2. Mehrere Kursarbeiten und Drittelregel
{
  const subject = makeSubject({
    courseworkShare: 0.333,
    assessments: [
      { id: 'c1', name: 'K1', type: 'Kursarbeit', points: 12, weight: 1 },
      { id: 'c2', name: 'K2', type: 'Kursarbeit', points: 15, weight: 1 },
      { id: 'o1', name: 'O1', type: 'Test', points: 10, weight: 1 },
      { id: 'o2', name: 'O2', type: 'Test', points: 11, weight: 1 },
    ],
  });

  const grade = buildGradeSummary(subject);
  assert.equal(Number(grade.courseAverage.toFixed(2)), 13.5);
  assert.equal(Number(grade.otherAverage.toFixed(2)), 10.5);
  assert.equal(Number(grade.finalAverage.toFixed(2)), 11.5);
}

// 3. Nur eine Kategorie zählt
{
  const subject = makeSubject({
    assessments: [
      { id: 'o1', name: 'O1', type: 'Test', points: 8, weight: 1 },
      { id: 'o2', name: 'O2', type: 'Test', points: 9, weight: 1 },
    ],
  });

  const grade = buildGradeSummary(subject);
  assert.equal(grade.provisional, true);
  assert.equal(Number(grade.finalAverage.toFixed(2)), 8.5);
}

// 4. Keine zählenden Noten
{
  const subject = makeSubject({
    assessments: [
      { id: 'z1', name: 'N1', type: 'Mündliche Note', points: 10, weight: 0 },
      { id: 'z2', name: 'N2', type: 'Kursarbeit', points: 10, weight: 0 },
    ],
  });

  const grade = buildGradeSummary(subject);
  assert.equal(grade.finalAverage, null);
  assert.equal(grade.explanation, 'Noch keine Bewertung');
}

// 5. Zielrechner mit Kursarbeit
{
  const subject = makeSubject({
    courseworkShare: 0.333,
    assessments: [
      { id: 'o1', name: 'O1', type: 'Test', points: 10, weight: 1 },
      { id: 'o2', name: 'O2', type: 'Test', points: 11, weight: 1 },
      { id: 'o3', name: 'O3', type: 'Test', points: 12, weight: 1 },
    ],
  });

  const goal = calculateTargetScore(subject, 12, 'Kursarbeit', 1);
  assert.equal(goal.requiredPoints, 14);
  assert.equal(goal.reachable, true);
  assert.ok(goal.maxReachable >= 15);
}

// 6. Gesamtaverage
{
  const subjects = [
    makeSubject({ id: 's1', assessments: [{ id: 'a1', name: 'T1', type: 'Test', points: 10, weight: 1 }] }),
    makeSubject({ id: 's2', assessments: [{ id: 'a2', name: 'T2', type: 'Test', points: 12, weight: 1 }] }),
    makeSubject({ id: 's3', assessments: [] }),
  ];

  assert.equal(Number(overallAverage(subjects).toFixed(2)), 11);
}

// 7. Import-Validierung
{
  const valid = validateImportedSubjects({
    subjects: [{ id: 'x', name: 'Deutsch', courseworkShare: 0.5, assessments: [{ name: 'Klausur', points: 13, weight: 1, type: 'Kursarbeit', date: '2026-01-01' }] }],
  });
  assert.equal(valid[0].name, 'Deutsch');
  assert.equal(valid[0].courseworkShare, 0.5);
}

// 8. Canonical share
assert.equal(canonicalShare(0.333), 0.333);
assert.equal(canonicalShare(0.8), 0.333);

console.log('All logic tests passed.');
