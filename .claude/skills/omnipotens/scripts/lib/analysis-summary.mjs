const REQUIRED_DIRECTIONS = Object.freeze([
  ['play-logic', '遊びのロジック'],
  ['code', 'コード内容'],
  ['ux', 'UX'],
  ['market', '市場分析'],
]);
const UX_DIMENSIONS = Object.freeze([
  ['core-implementation-alignment', '体験設計のコアと実装の方向一致'],
  ['expression-conviction-performance', '表現の納得性・パフォーマンス'],
]);
const PLAY_STRUCTURE_DIMENSIONS = Object.freeze([
  ['idea', '発想'],
  ['structure', '構造'],
  ['scalability', '量産性'],
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

function nonEmptyTexts(value, label) {
  const items = texts(value, label);
  if (items.length === 0) throw new Error(`${label} must not be empty.`);
  return items;
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

function averageImprovement(rawValue, label) {
  const raw = object(rawValue, label);
  if (!['improve', 'hold'].includes(raw.decision)) {
    throw new Error(`${label}.decision must be 'improve' or 'hold'.`);
  }
  return {
    decision: raw.decision,
    proposal: text(raw.proposal, `${label}.proposal`),
    rationale: text(raw.rationale, `${label}.rationale`),
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

function assessmentProfile(rawValue, label) {
  const raw = object(rawValue, label);
  return {
    summary: text(raw.summary, `${label}.summary`),
    strengths: nonEmptyTexts(raw.strengths, `${label}.strengths`),
    priorityIssues: nonEmptyTexts(raw.priorityIssues, `${label}.priorityIssues`),
  };
}

function overallAssessment(rawValue) {
  const raw = object(rawValue, 'overallAssessment');
  const current = score(raw.score, 'overallAssessment.score');
  const maximum = score(raw.maxScore, 'overallAssessment.maxScore');
  if (maximum === 0 || current > maximum) {
    throw new Error('overallAssessment.score must be between 0 and maxScore.');
  }
  return {
    label: text(raw.label, 'overallAssessment.label'),
    score: current,
    maxScore: maximum,
    beginner: assessmentProfile(raw.beginner, 'overallAssessment.beginner'),
    highResolution: assessmentProfile(raw.highResolution, 'overallAssessment.highResolution'),
    confidence: text(raw.confidence, 'overallAssessment.confidence'),
    sourceRefs: texts(raw.sourceRefs, 'overallAssessment.sourceRefs'),
    ...completeness(raw, 'overallAssessment'),
  };
}

function scoreRow(rawValue, rowLabel, { market = false, expectedId, expectedTitle } = {}) {
  const raw = object(rawValue, rowLabel);
  const current = score(raw.score, `${rowLabel}.score`);
  const maximum = score(raw.maxScore, `${rowLabel}.maxScore`);
  if (maximum === 0 || current > maximum) throw new Error(`${rowLabel}.score must be between 0 and maxScore.`);
  if (expectedId && raw.id !== expectedId) throw new Error(`${rowLabel}.id must be '${expectedId}'.`);
  return {
    ...(expectedId ? { id: expectedId } : {}),
    label: expectedTitle || text(raw.label, `${rowLabel}.label`),
    score: current,
    maxScore: maximum,
    rationale: text(raw.rationale, `${rowLabel}.rationale`),
    sourceRefs: texts(raw.sourceRefs, `${rowLabel}.sourceRefs`),
    ...(market ? { marketAdvantage: raw.marketAdvantage === true } : {}),
    averageImprovement: averageImprovement(raw.averageImprovement, `${rowLabel}.averageImprovement`),
    ...completeness(raw, rowLabel),
  };
}

function scoreRows(value, label, { market = false } = {}) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array.`);
  const rows = value.map((rawValue, index) => scoreRow(rawValue, `${label}[${index}]`, { market }));
  return market ? rows.sort((left, right) => (right.score / right.maxScore) - (left.score / left.maxScore)) : rows;
}

function dimensionScores(value, label, dimensions) {
  if (!Array.isArray(value) || value.length !== dimensions.length) {
    throw new Error(`${label} must contain exactly ${dimensions.length} dimensions.`);
  }
  const byId = new Map(value.map((item, index) => [object(item, `${label}[${index}]`).id, item]));
  if (byId.size !== dimensions.length) throw new Error(`${label} contains duplicate dimension ids.`);
  return dimensions.map(([id, title]) => scoreRow(byId.get(id), `${label}.${id}`, {
    expectedId: id,
    expectedTitle: title,
  }));
}

function uxEvaluation(rawValue) {
  const raw = object(rawValue, 'uxEvaluation');
  const simulation = object(raw.publicResponseSimulation, 'uxEvaluation.publicResponseSimulation');
  return {
    publicResponseSimulation: {
      audienceModel: text(simulation.audienceModel, 'uxEvaluation.publicResponseSimulation.audienceModel'),
      assumptions: nonEmptyTexts(simulation.assumptions, 'uxEvaluation.publicResponseSimulation.assumptions'),
      limitations: nonEmptyTexts(simulation.limitations, 'uxEvaluation.publicResponseSimulation.limitations'),
    },
    scores: dimensionScores(raw.scores, 'uxEvaluation.scores', UX_DIMENSIONS),
  };
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
      averageImprovement: averageImprovement(novelty.averageImprovement, 'ludus.novelty.averageImprovement'),
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
  if (raw.schemaVersion !== 4) throw new Error('Omnipotens analysis summary schemaVersion must be 4.');
  const directions = object(raw.executiveSummary, 'executiveSummary');
  const normalizedDirections = Object.fromEntries(REQUIRED_DIRECTIONS.map(([id, title]) => [
    id,
    narrative(directions[id], `executiveSummary.${id}`, id, title),
  ]));
  const additional = raw.additionalAnalyses ?? [];
  if (!Array.isArray(additional)) throw new Error('additionalAnalyses must be an array.');
  const normalized = {
    schemaVersion: 4,
    project: text(raw.project || projectTitle, 'project'),
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '',
    overallAssessment: overallAssessment(raw.overallAssessment),
    executiveSummary: normalizedDirections,
    additionalAnalyses: additional.map((item, index) => narrative(item, `additionalAnalyses[${index}]`)),
    aiFormatScores: scoreRows(raw.aiFormatScores, 'aiFormatScores'),
    vitiaScores: scoreRows(raw.vitiaScores, 'vitiaScores', { market: true }),
    uxEvaluation: uxEvaluation(raw.uxEvaluation),
    playStructureScores: dimensionScores(raw.playStructureScores, 'playStructureScores', PLAY_STRUCTURE_DIMENSIONS),
    ludus: ludus(raw.ludus),
  };
  if (normalized.ludus.novelty.maxScore === 0 || normalized.ludus.novelty.score > normalized.ludus.novelty.maxScore) {
    throw new Error('ludus.novelty.score must be between 0 and maxScore.');
  }
  return normalized;
}
