import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const EFFORTS = new Set(['S', 'M', 'L', 'XL']);
const GROUPS = new Set(['core', 'service']);
const REDISTRIBUTION = new Set(['allowed', 'conditional', 'prohibited', 'unknown']);
const CACHE_MODES = new Set(['raw-eligible', 'metadata-only', 'derived-summary']);

const TOP_LEVEL_KEYS = [
  'schemaVersion',
  'catalogVersion',
  'retrievedAt',
  'principlesJa',
  'analysisOptions',
  'presets',
  'serviceRubrics',
  'sources',
  'referenceFacts',
];

const ANALYSIS_OPTION_KEYS = [
  'id',
  'order',
  'group',
  'titleJa',
  'summaryJa',
  'effort',
  'requiredAnalysisIds',
  'recommendedAnalysisIds',
  'applicabilityQuestionsJa',
  'requiredEvidenceJa',
  'outputs',
  'sourceIds',
  'usesExternalService',
];

const SOURCE_KEYS = [
  'id',
  'title',
  'issuer',
  'sourceType',
  'canonicalUrl',
  'published',
  'version',
  'jurisdictions',
  'license',
  'cachePolicy',
  'scopeJa',
  'limitationsJa',
];

function invalid(path, message) {
  throw new Error(`invalid service analysis catalog at ${path}: ${message}`);
}

function assertRecord(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, 'must be an object');
  }
}

function assertExactKeys(value, expectedKeys, path) {
  assertRecord(value, path);
  const expected = new Set(expectedKeys);
  const actual = Object.keys(value);
  const missing = expectedKeys.filter((key) => !Object.hasOwn(value, key));
  const unknown = actual.filter((key) => !expected.has(key));
  if (missing.length > 0) invalid(path, `missing keys: ${missing.join(', ')}`);
  if (unknown.length > 0) invalid(path, `unknown keys: ${unknown.join(', ')}`);
}

function assertString(value, path) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    invalid(path, 'must be a non-empty trimmed string');
  }
}

function assertIdentifier(value, path) {
  assertString(value, path);
  if (!IDENTIFIER.test(value)) invalid(path, 'must be a stable lowercase identifier');
}

function assertInteger(value, path, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalid(path, `must be an integer from ${minimum} through ${maximum}`);
  }
}

function assertBoolean(value, path) {
  if (typeof value !== 'boolean') invalid(path, 'must be a boolean');
}

function assertStringArray(value, path, { allowEmpty = false, identifiers = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    invalid(path, allowEmpty ? 'must be an array' : 'must be a non-empty array');
  }
  const seen = new Set();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (identifiers) assertIdentifier(item, itemPath);
    else assertString(item, itemPath);
    if (seen.has(item)) invalid(itemPath, `duplicate value: ${item}`);
    seen.add(item);
  });
}

function assertHttpsUrl(value, path) {
  assertString(value, path);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    invalid(path, 'must be a valid absolute URL');
  }
  if (parsed.protocol !== 'https:') invalid(path, 'must use https');
  if (!parsed.hostname) invalid(path, 'must include a hostname');
  if (parsed.username || parsed.password) invalid(path, 'must not include credentials');
  if (parsed.hash) invalid(path, 'must not include a fragment');
}

function assertDate(value, path) {
  assertString(value, path);
  if (!DATE_ONLY.test(value)) invalid(path, 'must use YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    invalid(path, 'must be a real calendar date');
  }
}

function assertInstant(value, path) {
  assertString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    invalid(path, 'must be an ISO 8601 timestamp with a timezone');
  }
  if (Number.isNaN(Date.parse(value))) invalid(path, 'must be a valid timestamp');
}

function assertSafeRelativeOutput(value, path) {
  assertString(value, path);
  if (value.includes('\\') || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) {
    invalid(path, 'must be a portable relative path');
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    invalid(path, 'must not contain empty, dot, or parent segments');
  }
}

function assertUniqueIds(items, path) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item.id)) invalid(`${path}[${index}].id`, `duplicate id: ${item.id}`);
    seen.add(item.id);
  });
}

function validateAnalysisOption(option, index) {
  const path = `analysisOptions[${index}]`;
  assertExactKeys(option, ANALYSIS_OPTION_KEYS, path);
  assertIdentifier(option.id, `${path}.id`);
  assertInteger(option.order, `${path}.order`, { minimum: 1 });
  assertString(option.group, `${path}.group`);
  if (!GROUPS.has(option.group)) invalid(`${path}.group`, 'must be core or service');
  assertString(option.titleJa, `${path}.titleJa`);
  assertString(option.summaryJa, `${path}.summaryJa`);
  assertString(option.effort, `${path}.effort`);
  if (!EFFORTS.has(option.effort)) invalid(`${path}.effort`, 'must be S, M, L, or XL');
  assertStringArray(option.requiredAnalysisIds, `${path}.requiredAnalysisIds`, { allowEmpty: true, identifiers: true });
  assertStringArray(option.recommendedAnalysisIds, `${path}.recommendedAnalysisIds`, { allowEmpty: true, identifiers: true });
  assertStringArray(option.applicabilityQuestionsJa, `${path}.applicabilityQuestionsJa`);
  assertStringArray(option.requiredEvidenceJa, `${path}.requiredEvidenceJa`);
  assertStringArray(option.outputs, `${path}.outputs`);
  option.outputs.forEach((output, outputIndex) => assertSafeRelativeOutput(output, `${path}.outputs[${outputIndex}]`));
  assertStringArray(option.sourceIds, `${path}.sourceIds`, { allowEmpty: true, identifiers: true });
  assertBoolean(option.usesExternalService, `${path}.usesExternalService`);

  const required = new Set(option.requiredAnalysisIds);
  const overlap = option.recommendedAnalysisIds.filter((id) => required.has(id));
  if (overlap.length > 0) invalid(path, `required and recommended dependencies overlap: ${overlap.join(', ')}`);
}

function validatePreset(preset, index) {
  const path = `presets[${index}]`;
  assertExactKeys(preset, ['id', 'titleJa', 'descriptionJa', 'analysisIds'], path);
  assertIdentifier(preset.id, `${path}.id`);
  assertString(preset.titleJa, `${path}.titleJa`);
  assertString(preset.descriptionJa, `${path}.descriptionJa`);
  assertStringArray(preset.analysisIds, `${path}.analysisIds`, { identifiers: true });
}

function validateRubric(rubric, index) {
  const path = `serviceRubrics[${index}]`;
  assertExactKeys(
    rubric,
    ['id', 'titleJa', 'scoringRuleJa', 'dimensions', 'prohibitedShortcutsJa', 'requiredLocalOverlayJa'],
    path,
  );
  assertIdentifier(rubric.id, `${path}.id`);
  assertString(rubric.titleJa, `${path}.titleJa`);
  assertString(rubric.scoringRuleJa, `${path}.scoringRuleJa`);
  if (!Array.isArray(rubric.dimensions) || rubric.dimensions.length === 0) {
    invalid(`${path}.dimensions`, 'must be a non-empty array');
  }
  rubric.dimensions.forEach((dimension, dimensionIndex) => {
    const dimensionPath = `${path}.dimensions[${dimensionIndex}]`;
    assertExactKeys(dimension, ['id', 'titleJa', 'questionsJa', 'metricsJa', 'sourceIds'], dimensionPath);
    assertIdentifier(dimension.id, `${dimensionPath}.id`);
    assertString(dimension.titleJa, `${dimensionPath}.titleJa`);
    assertStringArray(dimension.questionsJa, `${dimensionPath}.questionsJa`);
    assertStringArray(dimension.metricsJa, `${dimensionPath}.metricsJa`);
    assertStringArray(dimension.sourceIds, `${dimensionPath}.sourceIds`, { allowEmpty: true, identifiers: true });
  });
  assertUniqueIds(rubric.dimensions, `${path}.dimensions`);
  assertStringArray(rubric.prohibitedShortcutsJa, `${path}.prohibitedShortcutsJa`);
  assertStringArray(rubric.requiredLocalOverlayJa, `${path}.requiredLocalOverlayJa`);
}

function validateSource(source, index) {
  const path = `sources[${index}]`;
  assertExactKeys(source, SOURCE_KEYS, path);
  assertIdentifier(source.id, `${path}.id`);
  assertString(source.title, `${path}.title`);
  assertString(source.issuer, `${path}.issuer`);
  assertIdentifier(source.sourceType, `${path}.sourceType`);
  assertHttpsUrl(source.canonicalUrl, `${path}.canonicalUrl`);
  assertString(source.published, `${path}.published`);
  assertString(source.version, `${path}.version`);
  assertStringArray(source.jurisdictions, `${path}.jurisdictions`);
  assertExactKeys(source.license, ['id', 'url', 'redistribution'], `${path}.license`);
  assertString(source.license.id, `${path}.license.id`);
  assertHttpsUrl(source.license.url, `${path}.license.url`);
  assertString(source.license.redistribution, `${path}.license.redistribution`);
  if (!REDISTRIBUTION.has(source.license.redistribution)) {
    invalid(`${path}.license.redistribution`, `unsupported value: ${source.license.redistribution}`);
  }
  assertExactKeys(source.cachePolicy, ['mode', 'refreshDays', 'rawBundled'], `${path}.cachePolicy`);
  assertString(source.cachePolicy.mode, `${path}.cachePolicy.mode`);
  if (!CACHE_MODES.has(source.cachePolicy.mode)) {
    invalid(`${path}.cachePolicy.mode`, `unsupported value: ${source.cachePolicy.mode}`);
  }
  assertInteger(source.cachePolicy.refreshDays, `${path}.cachePolicy.refreshDays`, { minimum: 1, maximum: 36500 });
  assertBoolean(source.cachePolicy.rawBundled, `${path}.cachePolicy.rawBundled`);
  assertString(source.scopeJa, `${path}.scopeJa`);
  assertStringArray(source.limitationsJa, `${path}.limitationsJa`);

  if (
    source.cachePolicy.mode === 'raw-eligible'
    && !['allowed', 'conditional'].includes(source.license.redistribution)
  ) {
    invalid(
      `${path}.cachePolicy.mode`,
      'raw-eligible requires redistribution=allowed or conditional',
    );
  }
  if (source.cachePolicy.mode === 'derived-summary'
      && !new Set(['allowed', 'conditional']).has(source.license.redistribution)) {
    invalid(`${path}.cachePolicy.mode`, 'derived-summary requires redistribution=allowed or conditional');
  }
  if (source.cachePolicy.rawBundled
      && (source.cachePolicy.mode !== 'raw-eligible' || source.license.redistribution !== 'allowed')) {
    invalid(`${path}.cachePolicy.rawBundled`, 'raw content may be bundled only when raw-eligible and allowed');
  }
}

function validateReferenceFact(fact, index) {
  const path = `referenceFacts[${index}]`;
  assertExactKeys(
    fact,
    ['id', 'sourceId', 'kind', 'value', 'status', 'observedAt', 'expiresAt', 'scopeJa', 'warningJa'],
    path,
  );
  assertIdentifier(fact.id, `${path}.id`);
  assertIdentifier(fact.sourceId, `${path}.sourceId`);
  assertIdentifier(fact.kind, `${path}.kind`);
  assertString(fact.value, `${path}.value`);
  assertString(fact.status, `${path}.status`);
  assertDate(fact.observedAt, `${path}.observedAt`);
  assertDate(fact.expiresAt, `${path}.expiresAt`);
  if (fact.expiresAt < fact.observedAt) invalid(`${path}.expiresAt`, 'must not precede observedAt');
  assertString(fact.scopeJa, `${path}.scopeJa`);
  assertString(fact.warningJa, `${path}.warningJa`);
}

function assertReferences(catalog) {
  const analysisIds = new Set(catalog.analysisOptions.map((option) => option.id));
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const rubricIds = new Set(catalog.serviceRubrics.map((rubric) => rubric.id));

  catalog.analysisOptions.forEach((option, index) => {
    for (const [field, references] of [
      ['requiredAnalysisIds', option.requiredAnalysisIds],
      ['recommendedAnalysisIds', option.recommendedAnalysisIds],
    ]) {
      references.forEach((id, referenceIndex) => {
        if (!analysisIds.has(id)) invalid(`analysisOptions[${index}].${field}[${referenceIndex}]`, `unknown analysis id: ${id}`);
      });
    }
    option.sourceIds.forEach((id, sourceIndex) => {
      if (!sourceIds.has(id)) invalid(`analysisOptions[${index}].sourceIds[${sourceIndex}]`, `unknown source id: ${id}`);
    });
    if (option.group === 'service' && !rubricIds.has(option.id)) {
      invalid(`analysisOptions[${index}].id`, `service analysis must have exactly one rubric: ${option.id}`);
    }
  });

  catalog.presets.forEach((preset, index) => {
    preset.analysisIds.forEach((id, analysisIndex) => {
      if (!analysisIds.has(id)) invalid(`presets[${index}].analysisIds[${analysisIndex}]`, `unknown analysis id: ${id}`);
    });
  });

  catalog.serviceRubrics.forEach((rubric, rubricIndex) => {
    const option = catalog.analysisOptions.find((candidate) => candidate.id === rubric.id);
    if (!option) invalid(`serviceRubrics[${rubricIndex}].id`, `unknown analysis id: ${rubric.id}`);
    if (option?.group !== 'service') invalid(`serviceRubrics[${rubricIndex}].id`, 'must refer to a service analysis option');
    rubric.dimensions.forEach((dimension, dimensionIndex) => {
      dimension.sourceIds.forEach((id, sourceIndex) => {
        if (!sourceIds.has(id)) {
          invalid(
            `serviceRubrics[${rubricIndex}].dimensions[${dimensionIndex}].sourceIds[${sourceIndex}]`,
            `unknown source id: ${id}`,
          );
        }
      });
    });
  });

  catalog.referenceFacts.forEach((fact, index) => {
    if (!sourceIds.has(fact.sourceId)) invalid(`referenceFacts[${index}].sourceId`, `unknown source id: ${fact.sourceId}`);
  });
}

function assertAcyclicRequiredDependencies(analysisOptions) {
  const byId = new Map(analysisOptions.map((option) => [option.id, option]));
  const visiting = new Set();
  const visited = new Set();

  function visit(id, path) {
    if (visiting.has(id)) invalid(path, `required dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const option = byId.get(id);
    option.requiredAnalysisIds.forEach((dependencyId, index) => {
      visit(dependencyId, `${path}.requiredAnalysisIds[${index}]`);
    });
    visiting.delete(id);
    visited.add(id);
  }

  analysisOptions.forEach((option, index) => visit(option.id, `analysisOptions[${index}]`));
}

export function validateServiceAnalysisCatalog(catalog) {
  assertExactKeys(catalog, TOP_LEVEL_KEYS, '$');
  if (catalog.schemaVersion !== 1) invalid('schemaVersion', 'must equal 1');
  assertString(catalog.catalogVersion, 'catalogVersion');
  assertInstant(catalog.retrievedAt, 'retrievedAt');
  assertStringArray(catalog.principlesJa, 'principlesJa');

  for (const [field, validator] of [
    ['analysisOptions', validateAnalysisOption],
    ['presets', validatePreset],
    ['serviceRubrics', validateRubric],
    ['sources', validateSource],
    ['referenceFacts', validateReferenceFact],
  ]) {
    if (!Array.isArray(catalog[field]) || catalog[field].length === 0) invalid(field, 'must be a non-empty array');
    catalog[field].forEach(validator);
    assertUniqueIds(catalog[field], field);
  }

  const orders = new Set();
  catalog.analysisOptions.forEach((option, index) => {
    if (orders.has(option.order)) invalid(`analysisOptions[${index}].order`, `duplicate order: ${option.order}`);
    orders.add(option.order);
  });

  assertReferences(catalog);
  assertAcyclicRequiredDependencies(catalog.analysisOptions);
  return catalog;
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateCatalogSha256(value) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new Error('catalog sha256 must be 64 lowercase hexadecimal characters');
  }
  return value;
}

export async function loadServiceAnalysisCatalog(path) {
  const bytes = await readFile(path);
  let catalog;
  try {
    catalog = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to parse service analysis catalog: ${detail}`);
  }
  validateServiceAnalysisCatalog(catalog);
  return { catalog, catalogSha256: sha256Hex(bytes) };
}
