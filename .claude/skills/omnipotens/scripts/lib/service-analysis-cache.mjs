import { basename } from 'node:path';
import { validateServiceAnalysisCatalog } from './service-analysis-catalog.mjs';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeGeneratedAt(value, now) {
  if (value === undefined) return now.toISOString();
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('generated-at must be a non-empty ISO 8601 date or timestamp');
  }
  const normalized = DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value;
  if (!DATE_ONLY.test(value)
      && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value))) {
    throw new Error('generated-at must include a timezone');
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error('generated-at is not a valid date or timestamp');
  if (DATE_ONLY.test(value) && parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('generated-at is not a real calendar date');
  }
  return parsed.toISOString();
}

function expiresAtEndOfDay(expiresAt) {
  return Date.parse(`${expiresAt}T23:59:59.999Z`);
}

function sourceMetadataExpiresAt(retrievedAt, refreshDays) {
  return Date.parse(retrievedAt) + (refreshDays * MILLISECONDS_PER_DAY);
}

function selectedSourceIds(analysisOptions, rubrics) {
  const ids = new Set();
  analysisOptions.forEach((option) => option.sourceIds.forEach((id) => ids.add(id)));
  rubrics.forEach((rubric) => {
    rubric.dimensions.forEach((dimension) => dimension.sourceIds.forEach((id) => ids.add(id)));
  });
  return ids;
}

export function buildServiceAnalysisCache({ catalog, plan, generatedAt, requireCurrent = false, now = new Date() }) {
  validateServiceAnalysisCatalog(catalog);
  if (plan.catalogVersion !== catalog.catalogVersion) {
    throw new Error(`plan catalog version mismatch: ${plan.catalogVersion} != ${catalog.catalogVersion}`);
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('now must be a valid Date');
  if (typeof requireCurrent !== 'boolean') throw new Error('requireCurrent must be a boolean');

  const normalizedGeneratedAt = normalizeGeneratedAt(generatedAt, now);
  const generatedTime = Date.parse(normalizedGeneratedAt);
  const resolved = new Set(plan.resolvedAnalysisIds);
  const analysisOptions = catalog.analysisOptions.filter((option) => resolved.has(option.id));
  if (analysisOptions.length !== resolved.size) throw new Error('plan contains an unknown resolved analysis id');
  const serviceRubrics = catalog.serviceRubrics.filter((rubric) => resolved.has(rubric.id));
  const sourceIds = selectedSourceIds(analysisOptions, serviceRubrics);
  const sources = catalog.sources.filter((source) => sourceIds.has(source.id));
  if (sources.length !== sourceIds.size) throw new Error('selected analysis contains an unknown source id');
  const staleSourceIds = sources
    .filter((source) => generatedTime >= sourceMetadataExpiresAt(
      catalog.retrievedAt,
      source.cachePolicy.refreshDays,
    ))
    .map((source) => source.id);
  const referenceFacts = catalog.referenceFacts.filter((fact) => sourceIds.has(fact.sourceId));
  const staleFactIds = referenceFacts
    .filter((fact) => generatedTime > expiresAtEndOfDay(fact.expiresAt))
    .map((fact) => fact.id);

  if (requireCurrent && (staleSourceIds.length > 0 || staleFactIds.length > 0)) {
    const diagnostics = [];
    if (staleSourceIds.length > 0) {
      diagnostics.push(`stale source metadata: ${staleSourceIds.join(', ')}`);
    }
    if (staleFactIds.length > 0) {
      diagnostics.push(`expired reference facts: ${staleFactIds.join(', ')}`);
    }
    throw new Error(diagnostics.join('; '));
  }

  return {
    schemaVersion: 1,
    cacheKind: 'omnipotens-service-analysis',
    generatedAt: normalizedGeneratedAt,
    classification: plan.classification,
    project: {
      name: basename(plan.projectRoot),
      root: plan.classification === 'internal' ? plan.projectRoot : null,
    },
    catalog: {
      schemaVersion: catalog.schemaVersion,
      catalogVersion: catalog.catalogVersion,
      retrievedAt: catalog.retrievedAt,
      sha256: plan.catalogSha256,
    },
    selection: {
      selectedAnalysisIds: [...plan.selectedAnalysisIds],
      resolvedAnalysisIds: [...plan.resolvedAnalysisIds],
      requiredDependencyIds: [...plan.requiredDependencyIds],
    },
    principlesJa: [...catalog.principlesJa],
    rawSourceBodiesIncluded: false,
    analysisOptions,
    serviceRubrics,
    sources,
    referenceFacts,
    freshness: {
      requireCurrent,
      dynamicFactCount: referenceFacts.length,
      staleSourceIds,
      staleFactIds,
      isCurrent: staleSourceIds.length === 0 && staleFactIds.length === 0,
    },
  };
}
