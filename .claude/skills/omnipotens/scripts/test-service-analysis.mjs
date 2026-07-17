#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAnalysisRunPlan } from './lib/analysis-run-plan.mjs';
import { buildServiceAnalysisCache } from './lib/service-analysis-cache.mjs';
import {
  loadServiceAnalysisCatalog,
  sha256Hex,
  validateServiceAnalysisCatalog,
} from './lib/service-analysis-catalog.mjs';
import { runServiceCacheCli } from './omnipotens-service-cache.mjs';

function analysisOption({ id, order, group, required = [], sources = [] }) {
  return {
    id,
    order,
    group,
    titleJa: `${id} 分析`,
    summaryJa: `${id} を根拠付きで分析します。`,
    effort: 'M',
    requiredAnalysisIds: required,
    recommendedAnalysisIds: [],
    applicabilityQuestionsJa: ['対象に適用できますか。'],
    requiredEvidenceJa: ['一次資料'],
    outputs: [`spec/${id.replaceAll('.', '-')}.md`],
    sourceIds: sources,
    usesExternalService: false,
  };
}

function source({ id, redistribution, mode }) {
  return {
    id,
    title: `${id} source`,
    issuer: 'Fixture Issuer',
    sourceType: 'official-guidance',
    canonicalUrl: `https://example.com/${id}`,
    published: '2026',
    version: '1.0',
    jurisdictions: ['test'],
    license: {
      id: `${id}-LICENSE`,
      url: `https://example.com/${id}/license`,
      redistribution,
    },
    cachePolicy: { mode, refreshDays: 30, rawBundled: false },
    scopeJa: `${id} の評価範囲です。`,
    limitationsJa: ['fixture以外へ一般化できません。'],
  };
}

function rubric(id, sourceId) {
  return {
    id,
    titleJa: `${id} rubric`,
    scoringRuleJa: '適用可能性、根拠強度、riskを分離します。',
    dimensions: [{
      id: 'evidence',
      titleJa: '根拠',
      questionsJa: ['一次資料がありますか。'],
      metricsJa: ['coverage'],
      sourceIds: [sourceId],
    }],
    prohibitedShortcutsJa: ['N/Aをゼロ点へ変換しません。'],
    requiredLocalOverlayJa: ['project実測値'],
  };
}

function fixtureCatalog() {
  return {
    schemaVersion: 1,
    catalogVersion: '2026.01.01.1',
    retrievedAt: '2026-01-01T00:00:00Z',
    principlesJa: ['選択していない分析を実行しません。'],
    analysisOptions: [
      analysisOption({ id: 'core.base', order: 10, group: 'core' }),
      analysisOption({ id: 'service.data', order: 20, group: 'service', required: ['core.base'], sources: ['source.open'] }),
      analysisOption({
        id: 'service.security',
        order: 30,
        group: 'service',
        required: ['service.data'],
        sources: ['source.restricted'],
      }),
    ],
    presets: [{
      id: 'fixture-full',
      titleJa: 'fixture full',
      descriptionJa: 'fixtureの全分析です。',
      analysisIds: ['core.base', 'service.data', 'service.security'],
    }],
    serviceRubrics: [
      rubric('service.data', 'source.open'),
      rubric('service.security', 'source.restricted'),
    ],
    sources: [
      source({ id: 'source.open', redistribution: 'allowed', mode: 'raw-eligible' }),
      source({ id: 'source.restricted', redistribution: 'prohibited', mode: 'metadata-only' }),
    ],
    referenceFacts: [
      {
        id: 'open-current-version',
        sourceId: 'source.open',
        kind: 'version',
        value: '1.0',
        status: 'effective',
        observedAt: '2026-01-01',
        expiresAt: '2026-01-31',
        scopeJa: 'fixture version',
        warningJa: '更新を確認してください。',
      },
      {
        id: 'restricted-current-rate',
        sourceId: 'source.restricted',
        kind: 'platform-fee',
        value: 'fixture rate',
        status: 'effective',
        observedAt: '2026-01-01',
        expiresAt: '2026-01-03',
        scopeJa: 'fixture rate',
        warningJa: '契約を確認してください。',
      },
    ],
  };
}

function assertInvalidCatalog(mutator, pattern) {
  const catalog = structuredClone(fixtureCatalog());
  mutator(catalog);
  assert.throws(() => validateServiceAnalysisCatalog(catalog), pattern);
}

const catalog = fixtureCatalog();
assert.equal(validateServiceAnalysisCatalog(catalog), catalog);
assert.equal(sha256Hex('fixture').length, 64);

assertInvalidCatalog((value) => value.sources.push(structuredClone(value.sources[0])), /duplicate id/);
assertInvalidCatalog((value) => { value.sources[0].canonicalUrl = 'http://example.com/source'; }, /must use https/);
assertInvalidCatalog((value) => {
  value.sources[0].license.redistribution = 'prohibited';
}, /raw-eligible requires redistribution=allowed/);
assertInvalidCatalog((value) => {
  value.analysisOptions[1].requiredAnalysisIds = ['service.missing'];
}, /unknown analysis id/);
assertInvalidCatalog((value) => {
  value.serviceRubrics = value.serviceRubrics.filter((item) => item.id !== 'service.security');
}, /service analysis must have exactly one rubric/);
assertInvalidCatalog((value) => {
  value.analysisOptions[0].requiredAnalysisIds = ['service.security'];
}, /required dependency cycle/);

const root = await mkdtemp(join(tmpdir(), 'omnipotens-service-analysis-'));
try {
  const project = join(root, 'project');
  const catalogPath = join(root, 'catalog.json');
  const output = join(root, 'cache', 'service-analysis.json');
  await mkdir(project, { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  const loaded = await loadServiceAnalysisCatalog(catalogPath);
  const plan = await createAnalysisRunPlan({
    ...loaded,
    selectedAnalysisIds: ['service.security'],
    classification: 'public',
    projectRoot: project,
  });
  assert.deepEqual(plan.resolvedAnalysisIds, ['core.base', 'service.data', 'service.security']);
  assert.deepEqual(plan.requiredDependencyIds, ['core.base', 'service.data']);
  await assert.rejects(
    () => createAnalysisRunPlan({
      ...loaded,
      selectedAnalysisIds: ['service.unknown'],
      classification: 'public',
      projectRoot: project,
    }),
    /unknown selected analysis id/,
  );
  await assert.rejects(
    () => createAnalysisRunPlan({
      ...loaded,
      selectedAnalysisIds: ['service.data', 'service.data'],
      classification: 'public',
      projectRoot: project,
    }),
    /duplicate selected analysis id/,
  );
  await assert.rejects(
    () => createAnalysisRunPlan({
      catalog: loaded.catalog,
      catalogSha256: 'not-a-hash',
      selectedAnalysisIds: ['service.data'],
      classification: 'public',
      projectRoot: project,
    }),
    /catalog sha256/,
  );

  const staleCache = buildServiceAnalysisCache({
    catalog: loaded.catalog,
    plan,
    generatedAt: '2026-01-04',
  });
  assert.deepEqual(staleCache.freshness.staleSourceIds, []);
  assert.deepEqual(staleCache.freshness.staleFactIds, ['restricted-current-rate']);
  assert.equal(staleCache.freshness.isCurrent, false);
  assert.equal(staleCache.project.root, null);
  assert.throws(
    () => buildServiceAnalysisCache({
      catalog: loaded.catalog,
      plan,
      generatedAt: '2026-01-04',
      requireCurrent: true,
    }),
    /expired reference facts/,
  );

  const shortRefreshCatalog = structuredClone(loaded.catalog);
  shortRefreshCatalog.sources.forEach((item) => {
    item.cachePolicy.refreshDays = 1;
  });
  const staleSourceCache = buildServiceAnalysisCache({
    catalog: shortRefreshCatalog,
    plan,
    generatedAt: '2026-01-03',
  });
  assert.deepEqual(staleSourceCache.freshness.staleSourceIds, [
    'source.open',
    'source.restricted',
  ]);
  assert.deepEqual(staleSourceCache.freshness.staleFactIds, []);
  assert.equal(staleSourceCache.freshness.isCurrent, false);
  assert.throws(
    () => buildServiceAnalysisCache({
      catalog: shortRefreshCatalog,
      plan,
      generatedAt: '2026-01-03',
      requireCurrent: true,
    }),
    /stale source metadata: source\.open, source\.restricted/,
  );

  const stdout = [];
  const firstRun = await runServiceCacheCli({
    argv: [
      '--output', output,
      '--analysis', 'service.security',
      '--classification', 'public',
      '--project', project,
      '--generated-at', '2026-01-02',
      '--require-current',
    ],
    catalogPath,
    writeStdout: (text) => stdout.push(text),
  });
  assert.equal(stdout.length, 1);
  assert.deepEqual(JSON.parse(stdout[0]), firstRun.receipt);
  assert.match(firstRun.receipt.outputSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(firstRun.receipt.staleSourceIds, []);
  const written = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(written.selection.resolvedAnalysisIds, ['core.base', 'service.data', 'service.security']);
  assert.equal(written.sources.length, 2);
  assert.equal(written.rawSourceBodiesIncluded, false);

  await writeFile(output, 'sentinel\n', 'utf8');
  await assert.rejects(
    () => runServiceCacheCli({
      argv: [
        '--output', output,
        '--analysis', 'service.security',
        '--classification', 'internal',
        '--project', project,
        '--generated-at', '2026-01-04',
        '--require-current',
      ],
      catalogPath,
      writeStdout: () => {},
    }),
    /expired reference facts/,
  );
  assert.equal(await readFile(output, 'utf8'), 'sentinel\n');

  await runServiceCacheCli({
    argv: [
      '--output', output,
      '--analysis', 'service.security',
      '--classification', 'internal',
      '--project', project,
      '--generated-at', '2026-01-04',
    ],
    catalogPath,
    writeStdout: () => {},
  });
  assert.notEqual(await readFile(output, 'utf8'), 'sentinel\n');
  const temporaryFiles = (await readdir(join(root, 'cache'))).filter((name) => name.endsWith('.tmp'));
  assert.deepEqual(temporaryFiles, []);

  await assert.rejects(
    () => runServiceCacheCli({
      argv: ['--unknown', 'value'],
      catalogPath,
      writeStdout: () => {},
    }),
    /unknown option/,
  );
  const verifyStdout = [];
  const verified = await runServiceCacheCli({
    argv: [
      '--analysis', 'service.data',
      '--classification', 'public',
      '--project', project,
      '--verify-only',
    ],
    catalogPath,
    now: new Date('2026-01-02T00:00:00Z'),
    writeStdout: (text) => verifyStdout.push(text),
  });
  assert.equal(verified.receipt.verifyOnly, true);
  assert.equal(verified.receipt.output, null);
  assert.equal(verifyStdout.length, 1);
} finally {
  await rm(root, { recursive: true, force: true });
}

const productionCatalogPath = fileURLToPath(new URL('../references/service-analysis-catalog.json', import.meta.url));
const production = await loadServiceAnalysisCatalog(productionCatalogPath);
const addedServiceIds = [
  'service.regional-ratings',
  'service.console-certification',
  'service.sbom',
  'service.vendor-risk',
  'service.child-safety',
  'service.generative-ai-governance',
];
assert.equal(production.catalog.analysisOptions.length, 25);
assert.equal(production.catalog.analysisOptions.filter((option) => option.group === 'service').length, 14);
assert.equal(production.catalog.presets.length, 8);
assert.equal(production.catalog.serviceRubrics.length, 14);
assert.equal(production.catalog.sources.length, 60);
assert.equal(production.catalog.referenceFacts.length, 14);
assert.equal(production.catalog.sources.some((item) => item.cachePolicy.rawBundled), false);
for (const id of addedServiceIds) {
  assert.ok(production.catalog.analysisOptions.some((option) => option.id === id), `missing analysis: ${id}`);
  assert.ok(production.catalog.serviceRubrics.some((rubricItem) => rubricItem.id === id), `missing rubric: ${id}`);
}
const fullSpectrum = production.catalog.presets.find((preset) => preset.id === 'full-spectrum-local');
assert.ok(fullSpectrum);
assert.deepEqual(
  fullSpectrum.analysisIds.filter((id) => id.startsWith('service.')),
  production.catalog.analysisOptions.filter((option) => option.group === 'service').map((option) => option.id),
);
assert.ok(production.catalog.presets.some((preset) => preset.id === 'console-release-gate'));
assert.match(production.catalogSha256, /^[a-f0-9]{64}$/);

process.stdout.write('service analysis tests: ok\n');
