const REQUIRED_DIRECTIONS = Object.freeze([
  ['play-logic', '遊びのロジック'],
  ['code', 'コード内容'],
  ['ux', 'UX'],
  ['market', '市場分析'],
]);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function text(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function texts(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => text(item, `${label}[${index}]`));
}

function score(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number.`);
  return value;
}

function completeness(raw, label) {
  return {
    missingInformation: texts(raw.missingInformation, `${label}.missingInformation`),
    missingImplementation: texts(raw.missingImplementation, `${label}.missingImplementation`),
  };
}

function narrative(rawValue, label, expectedId, expectedTitle) {
  const raw = object(rawValue, label);
  const id = text(raw.id, `${label}.id`);
  if (expectedId && id !== expectedId) throw new Error(`${label}.id must be '${expectedId}'.`);
  return {
    id,
    title: expectedTitle || text(raw.title, `${label}.title`),
    beginner: text(raw.beginner, `${label}.beginner`),
    highResolution: text(raw.highResolution, `${label}.highResolution`),
    ...completeness(raw, label),
  };
}

function scoreRows(value, label, { market = false } = {}) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array.`);
  const rows = value.map((rawValue, index) => {
    const rowLabel = `${label}[${index}]`;
    const raw = object(rawValue, rowLabel);
    const current = score(raw.score, `${rowLabel}.score`);
    const maximum = score(raw.maxScore, `${rowLabel}.maxScore`);
    if (maximum === 0 || current > maximum) throw new Error(`${rowLabel}.score must be between 0 and maxScore.`);
    return {
      label: text(raw.label, `${rowLabel}.label`),
      score: current,
      maxScore: maximum,
      rationale: text(raw.rationale, `${rowLabel}.rationale`),
      sourceRefs: texts(raw.sourceRefs, `${rowLabel}.sourceRefs`),
      ...(market ? { marketAdvantage: raw.marketAdvantage === true } : {}),
      ...completeness(raw, rowLabel),
    };
  });
  return market ? rows.sort((left, right) => (right.score / right.maxScore) - (left.score / left.maxScore)) : rows;
}

function ludus(rawValue) {
  const raw = object(rawValue, 'ludus');
  const novelty = object(raw.novelty, 'ludus.novelty');
  const recommendations = raw.recommendedImplementations;
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    throw new Error('ludus.recommendedImplementations must be a non-empty array.');
  }
  return {
    novelty: {
      score: score(novelty.score, 'ludus.novelty.score'),
      maxScore: score(novelty.maxScore, 'ludus.novelty.maxScore'),
      rationale: text(novelty.rationale, 'ludus.novelty.rationale'),
      sourceRefs: texts(novelty.sourceRefs, 'ludus.novelty.sourceRefs'),
      ...completeness(novelty, 'ludus.novelty'),
    },
    recommendedImplementations: recommendations.map((value, index) => {
      const label = `ludus.recommendedImplementations[${index}]`;
      const item = object(value, label);
      return {
        title: text(item.title, `${label}.title`),
        dictionaryEntries: texts(item.dictionaryEntries, `${label}.dictionaryEntries`),
        proposal: text(item.proposal, `${label}.proposal`),
        uxConnection: text(item.uxConnection, `${label}.uxConnection`),
        priority: text(item.priority, `${label}.priority`),
        ...completeness(item, label),
      };
    }),
  };
}

export function normalizeAnalysisSummary(rawValue, projectTitle) {
  const raw = object(rawValue, 'Omnipotens analysis summary');
  if (raw.schemaVersion !== 1) throw new Error('Omnipotens analysis summary schemaVersion must be 1.');
  const directions = object(raw.executiveSummary, 'executiveSummary');
  const normalizedDirections = Object.fromEntries(REQUIRED_DIRECTIONS.map(([id, title]) => [
    id,
    narrative(directions[id], `executiveSummary.${id}`, id, title),
  ]));
  const additional = raw.additionalAnalyses ?? [];
  if (!Array.isArray(additional)) throw new Error('additionalAnalyses must be an array.');
  const normalized = {
    schemaVersion: 1,
    project: text(raw.project || projectTitle, 'project'),
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '',
    executiveSummary: normalizedDirections,
    additionalAnalyses: additional.map((item, index) => narrative(item, `additionalAnalyses[${index}]`)),
    aiFormatScores: scoreRows(raw.aiFormatScores, 'aiFormatScores'),
    vitiaScores: scoreRows(raw.vitiaScores, 'vitiaScores', { market: true }),
    ludus: ludus(raw.ludus),
  };
  if (normalized.ludus.novelty.maxScore === 0 || normalized.ludus.novelty.score > normalized.ludus.novelty.maxScore) {
    throw new Error('ludus.novelty.score must be between 0 and maxScore.');
  }
  return normalized;
}

export function analysisSummarySourcePath(project) {
  return `${project}/spec/data/omnipotens-summary.json`;
}
