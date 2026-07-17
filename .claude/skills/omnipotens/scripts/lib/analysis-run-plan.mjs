import { lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateCatalogSha256, validateServiceAnalysisCatalog } from './service-analysis-catalog.mjs';

const CLASSIFICATIONS = new Set(['public', 'internal']);

function validateSelectedIds(selectedAnalysisIds, optionsById) {
  if (!Array.isArray(selectedAnalysisIds) || selectedAnalysisIds.length === 0) {
    throw new Error('at least one analysis id must be selected');
  }
  const seen = new Set();
  selectedAnalysisIds.forEach((id, index) => {
    if (typeof id !== 'string' || id.length === 0) throw new Error(`selected analysis id at index ${index} is invalid`);
    if (seen.has(id)) throw new Error(`duplicate selected analysis id: ${id}`);
    if (!optionsById.has(id)) throw new Error(`unknown selected analysis id: ${id}`);
    seen.add(id);
  });
}

function resolveRequiredDependencies(selectedAnalysisIds, optionsById) {
  const visited = new Set();
  const ordered = [];

  function visit(id) {
    if (visited.has(id)) return;
    const option = optionsById.get(id);
    option.requiredAnalysisIds.forEach(visit);
    visited.add(id);
    ordered.push(id);
  }

  selectedAnalysisIds.forEach(visit);
  return ordered;
}

async function validateProjectRoot(projectRoot) {
  if (typeof projectRoot !== 'string' || projectRoot.trim() !== projectRoot || projectRoot.length === 0) {
    throw new Error('project root must be a non-empty trimmed path');
  }
  const absolute = resolve(projectRoot);
  let canonical;
  try {
    canonical = await realpath(absolute);
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'ENOENT') throw new Error(`project root does not exist: ${absolute}`);
    throw error;
  }
  const info = await lstat(canonical);
  if (!info.isDirectory()) throw new Error(`project root is not a directory: ${canonical}`);
  return canonical;
}

export async function createAnalysisRunPlan({
  catalog,
  catalogSha256,
  selectedAnalysisIds,
  classification,
  projectRoot,
}) {
  validateServiceAnalysisCatalog(catalog);
  validateCatalogSha256(catalogSha256);
  if (!CLASSIFICATIONS.has(classification)) {
    throw new Error('classification must be public or internal');
  }

  const optionsById = new Map(catalog.analysisOptions.map((option) => [option.id, option]));
  validateSelectedIds(selectedAnalysisIds, optionsById);
  const resolvedAnalysisIds = resolveRequiredDependencies(selectedAnalysisIds, optionsById);
  const selected = new Set(selectedAnalysisIds);
  const requiredDependencyIds = resolvedAnalysisIds.filter((id) => !selected.has(id));
  const canonicalProjectRoot = await validateProjectRoot(projectRoot);

  return {
    schemaVersion: 1,
    catalogVersion: catalog.catalogVersion,
    catalogSha256,
    classification,
    projectRoot: canonicalProjectRoot,
    selectedAnalysisIds: [...selectedAnalysisIds],
    resolvedAnalysisIds,
    requiredDependencyIds,
  };
}
