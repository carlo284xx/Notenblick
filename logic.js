(function (global) {
  const WEIGHT_OPTIONS = [
    { label: '0-fach', value: 0 },
    { label: '1-fach', value: 1 },
    { label: '2-fach', value: 2 },
    { label: '0,5-fach', value: 0.5 },
    { label: '0,333-fach', value: 0.333 }
  ];

  const COURSEWORK_SHARE_OPTIONS = [
    { label: 'Ein Drittel', value: 0.333 },
    { label: '50 %', value: 0.5 },
    { label: '100 %', value: 1 },
    { label: '0 %', value: 0 }
  ];

  const PERFORMANCE_TYPES = [
    'Mündliche Note',
    'Test',
    'Vortrag',
    'Vokabeltest',
    'LB-Aufgabe',
    'Kursarbeit'
  ];

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const normalizeAssessment = (assessment = {}) => {
    const points = toNumber(assessment.points);
    const weight = toNumber(assessment.weight);
    const normalized = {
      id: assessment.id || createId(),
      name: String(assessment.name || '').trim() || 'Leistung',
      date: assessment.date || new Date().toISOString().slice(0, 10),
      type: PERFORMANCE_TYPES.includes(assessment.type) ? assessment.type : 'Mündliche Note',
      points: points === null ? 0 : clamp(points, 0, 15),
      weight: weight === null ? 1 : weight,
    };

    return normalized;
  };

  const canonicalShare = (value) => {
    const number = toNumber(value);
    if (number === null) return 0.333;
    if (number === 0.333 || number === 0.5 || number === 1 || number === 0) return number;
    return 0.333;
  };

  const createId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const isCountableAssessment = (assessment) => {
    if (!assessment) return false;
    const points = toNumber(assessment.points);
    const weight = toNumber(assessment.weight);
    return points !== null && points >= 0 && points <= 15 && weight !== null && weight > 0;
  };

  const getAssessmentsByCategory = (subject, category) => {
    if (!subject || !Array.isArray(subject.assessments)) return [];
    return subject.assessments.filter((assessment) => {
      if (!isCountableAssessment(assessment)) return false;
      if (category === 'Kursarbeit') {
        return assessment.type === 'Kursarbeit';
      }
      return assessment.type !== 'Kursarbeit';
    });
  };

  const weightedAverage = (assessments) => {
    if (!Array.isArray(assessments) || assessments.length === 0) return null;
    const countable = assessments.filter(isCountableAssessment);
    if (countable.length === 0) return null;

    const totalWeight = countable.reduce((sum, assessment) => sum + Number(assessment.weight), 0);
    if (totalWeight <= 0) return null;

    const weightedTotal = countable.reduce((sum, assessment) => {
      return sum + Number(assessment.points) * Number(assessment.weight);
    }, 0);

    return weightedTotal / totalWeight;
  };

  const buildGradeSummary = (subject) => {
    const safeSubject = subject || { assessments: [] };
    const courseEntries = getAssessmentsByCategory(safeSubject, 'Kursarbeit');
    const otherEntries = getAssessmentsByCategory(safeSubject, 'Sonstige');
    const courseAverage = weightedAverage(courseEntries);
    const otherAverage = weightedAverage(otherEntries);

    const hasAnyCountable = courseAverage !== null || otherAverage !== null;
    if (!hasAnyCountable) {
      return {
        courseAverage: null,
        otherAverage: null,
        finalAverage: null,
        provisional: false,
        explanation: 'Noch keine Bewertung',
        courseShare: canonicalShare(safeSubject.courseworkShare),
        courseCount: courseEntries.length,
        otherCount: otherEntries.length,
      };
    }

    if (courseAverage === null && otherAverage !== null) {
      return {
        courseAverage: null,
        otherAverage: otherAverage,
        finalAverage: otherAverage,
        provisional: true,
        explanation: 'Vorläufiger Wert, da nur die sonstigen Leistungen zählen.',
        courseShare: canonicalShare(safeSubject.courseworkShare),
        courseCount: courseEntries.length,
        otherCount: otherEntries.length,
      };
    }

    if (courseAverage !== null && otherAverage === null) {
      return {
        courseAverage: courseAverage,
        otherAverage: null,
        finalAverage: courseAverage,
        provisional: true,
        explanation: 'Vorläufiger Wert, da nur die Kursarbeiten zählen.',
        courseShare: canonicalShare(safeSubject.courseworkShare),
        courseCount: courseEntries.length,
        otherCount: otherEntries.length,
      };
    }

    const share = canonicalShare(safeSubject.courseworkShare);
    const finalAverage = courseAverage * share + otherAverage * (1 - share);

    return {
      courseAverage,
      otherAverage,
      finalAverage,
      provisional: false,
      explanation: `Fachnote aus ${share === 0.333 ? 'einem Drittel' : share === 0.5 ? '50 %' : share === 1 ? '100 %' : '0 %'} Kursarbeitenanteil.`,
      courseShare: share,
      courseCount: courseEntries.length,
      otherCount: otherEntries.length,
    };
  };

  const formatAverage = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '–';
    return `${Number(value).toFixed(2).replace('.', ',')} Punkte`;
  };

  const subjectAverage = (subject) => {
    const result = buildGradeSummary(subject);
    return result.finalAverage;
  };

  const overallAverage = (subjects) => {
    const validAverages = subjects
      .map((subject) => subjectAverage(subject))
      .filter((value) => value !== null && value !== undefined);

    if (validAverages.length === 0) return null;
    const total = validAverages.reduce((sum, value) => sum + Number(value), 0);
    return total / validAverages.length;
  };

  const withInsertedAssessment = (subject, assessment) => {
    const nextAssessment = normalizeAssessment(assessment);
    const nextSubjects = Array.isArray(subject.assessments) ? subject.assessments.map((entry) => ({ ...entry })) : [];
    return {
      ...subject,
      assessments: [...nextSubjects, nextAssessment]
    };
  };

  const calculateTargetScore = (subject, desiredAverage, type, weightValue) => {
    const normalizedWeight = toNumber(weightValue);
    const desired = toNumber(desiredAverage);

    if (normalizedWeight === null || normalizedWeight < 0 || desired === null || desired < 0 || desired > 15) {
      return {
        requiredPoints: null,
        resultAverage: null,
        reachable: false,
        maxReachable: null,
        message: 'Bitte gültige Werte eingeben.',
        noInfluence: false,
      };
    }

    if (normalizedWeight === 0) {
      const base = buildGradeSummary(subject);
      return {
        requiredPoints: 0,
        resultAverage: base.finalAverage,
        reachable: base.finalAverage !== null && base.finalAverage >= desired,
        maxReachable: base.finalAverage,
        message: 'Diese Leistung hat keinen Einfluss, weil sie 0-fach gewichtet ist.',
        noInfluence: true,
      };
    }

    let requiredPoints = null;
    let requiredAverage = null;
    let maxReachable = null;

    for (let points = 0; points <= 15; points += 1) {
      const candidate = buildGradeSummary(withInsertedAssessment(subject, {
        id: createId(),
        name: 'Zielrechnung',
        date: new Date().toISOString().slice(0, 10),
        type,
        points,
        weight: normalizedWeight,
      }));

      if (candidate.finalAverage === null) continue;
      maxReachable = maxReachable === null ? candidate.finalAverage : Math.max(maxReachable, candidate.finalAverage);

      if (requiredPoints === null && candidate.finalAverage >= desired) {
        requiredPoints = points;
        requiredAverage = candidate.finalAverage;
      }
    }

    if (requiredPoints === null) {
      return {
        requiredPoints: null,
        resultAverage: null,
        reachable: false,
        maxReachable,
        message: 'Das Ziel ist mit einer einzelnen solchen Leistung nicht erreichbar.',
        noInfluence: false,
      };
    }

    return {
      requiredPoints,
      resultAverage: requiredAverage,
      reachable: true,
      maxReachable,
      message: `Die minimale Punktzahl ist ${requiredPoints} Punkte.`,
      noInfluence: false,
    };
  };

  const validateImportedSubjects = (input) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Die importierte Datei ist kein gültiges JSON-Objekt.');
    }

    const list = Array.isArray(input.subjects) ? input.subjects : Array.isArray(input) ? input : null;
    if (!list) {
      throw new Error('Die Datei enthält keine gültigen Fächer-Daten.');
    }

    return list.map((subject, index) => {
      if (!subject || typeof subject !== 'object') {
        throw new Error(`Fach an Position ${index + 1} ist ungültig.`);
      }

      const normalizedAssessments = Array.isArray(subject.assessments)
        ? subject.assessments.map((assessment) => normalizeAssessment(assessment))
        : [];

      const normalizedSubject = {
        id: subject.id || createId(),
        name: String(subject.name || `Fach ${index + 1}`).trim() || `Fach ${index + 1}`,
        courseworkShare: canonicalShare(subject.courseworkShare),
        assessments: normalizedAssessments,
      };

      return normalizedSubject;
    });
  };

  const api = {
    WEIGHT_OPTIONS,
    COURSEWORK_SHARE_OPTIONS,
    PERFORMANCE_TYPES,
    buildGradeSummary,
    weightedAverage,
    overallAverage,
    calculateTargetScore,
    normalizeAssessment,
    canonicalShare,
    validateImportedSubjects,
    formatAverage,
    createId,
    isCountableAssessment,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.NotenblickLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
