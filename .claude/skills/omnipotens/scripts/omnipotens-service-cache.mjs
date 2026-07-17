#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createAnalysisRunPlan } from './lib/analysis-run-plan.mjs';
import { writeJsonAtomically } from './lib/atomic-json-file.mjs';
import { buildServiceAnalysisCache } from './lib/service-analysis-cache.mjs';
import { parseServiceAnalysisArgs } from './lib/service-analysis-cli-options.mjs';
import { loadServiceAnalysisCatalog } from './lib/service-analysis-catalog.mjs';

export const DEFAULT_SERVICE_ANALYSIS_CATALOG = fileURLToPath(
  new URL('../references/service-analysis-catalog.json', import.meta.url),
);

export async function runServiceCacheCli({
  argv,
  cwd = process.cwd(),
  catalogPath = DEFAULT_SERVICE_ANALYSIS_CATALOG,
  now = new Date(),
  writeStdout = (text) => process.stdout.write(text),
}) {
  const args = parseServiceAnalysisArgs(argv);
  const { catalog, catalogSha256 } = await loadServiceAnalysisCatalog(catalogPath);
  const plan = await createAnalysisRunPlan({
    catalog,
    catalogSha256,
    selectedAnalysisIds: args.analysis,
    classification: args.classification,
    projectRoot: resolve(cwd, args.project),
  });
  const cache = buildServiceAnalysisCache({
    catalog,
    plan,
    generatedAt: args.generatedAt,
    requireCurrent: args.requireCurrent,
    now,
  });

  const publication = args.verifyOnly
    ? { output: null, outputSha256: null, bytesWritten: 0 }
    : await writeJsonAtomically(resolve(cwd, args.output), cache);
  const receipt = {
    ok: true,
    verifyOnly: args.verifyOnly,
    output: publication.output,
    outputSha256: publication.outputSha256,
    bytesWritten: publication.bytesWritten,
    catalogVersion: catalog.catalogVersion,
    catalogSha256,
    classification: plan.classification,
    generatedAt: cache.generatedAt,
    selectedAnalysisIds: plan.selectedAnalysisIds,
    resolvedAnalysisIds: plan.resolvedAnalysisIds,
    requiredDependencyIds: plan.requiredDependencyIds,
    rubricCount: cache.serviceRubrics.length,
    sourceCount: cache.sources.length,
    factCount: cache.referenceFacts.length,
    staleSourceIds: cache.freshness.staleSourceIds,
    staleFactIds: cache.freshness.staleFactIds,
  };
  writeStdout(`${JSON.stringify(receipt)}\n`);
  return { receipt, cache };
}

async function main() {
  try {
    await runServiceCacheCli({ argv: process.argv.slice(2) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`omnipotens-service-cache: ${message}\n`);
    process.exitCode = 1;
  }
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) await main();
