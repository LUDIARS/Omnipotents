import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { buildReportInputModel, stageOutputFilename } from './report-input-model.mjs';
import { assertReportOutputOwnership } from './report-output-ownership.mjs';
import { createReportPathBoundary, windowsSafePathKey } from './report-path-boundary.mjs';
import { publishReportGeneration } from './report-publication.mjs';
import { renderFinalReport, renderStageReport } from './report-renderer.mjs';

function portable(value) {
  return value.replace(/\\/g, '/');
}

function requirePathString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new TypeError(`${label} must be a non-empty path string.`);
  }
  return value;
}

function validateOptions({ projectRoot, specRoot, output, layoutPath, title, includes, generatedAt }) {
  requirePathString(projectRoot, 'projectRoot');
  if (specRoot !== undefined) requirePathString(specRoot, 'specRoot');
  if (output !== undefined) requirePathString(output, 'output');
  if (layoutPath !== undefined) requirePathString(layoutPath, 'layoutPath');
  if (title !== undefined && typeof title !== 'string') throw new TypeError('title must be a string when provided.');
  if (typeof generatedAt !== 'string') throw new TypeError('generatedAt must be a string.');
  if (!Array.isArray(includes)) throw new TypeError('includes must be an array.');
  includes.forEach((item, index) => requirePathString(item, `includes[${index}]`));
}

function isInside(root, candidate) {
  const pathFromRoot = relative(windowsSafePathKey(root), windowsSafePathKey(candidate));
  return pathFromRoot === ''
    || (!isAbsolute(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`));
}

function assertInputDoesNotOverlapPublication(input, label, { finalOutput, manifestPath, stagesDir }) {
  const inputKey = windowsSafePathKey(input);
  if (inputKey === windowsSafePathKey(finalOutput) || inputKey === windowsSafePathKey(manifestPath)) {
    throw new Error(`${label} must not also be a generated report output: ${input}`);
  }
  if (isInside(stagesDir, input)) {
    throw new Error(`${label} must not be inside the generated stages directory: ${input}`);
  }
}

async function validatePublicationTargets(boundary, { reportsDir, finalOutput, manifestPath, stagesDir }) {
  await boundary.assertOutputDirectory(reportsDir, 'Report output directory');
  await boundary.assertOutputFile(finalOutput, 'Final report output');
  await boundary.assertOutputFile(manifestPath, 'Report manifest output');
  await boundary.assertOutputDirectory(stagesDir, 'Report stages output directory');
  await assertReportOutputOwnership({ boundary, reportsDir, finalOutput, manifestPath, stagesDir });
}

function renderGeneration({ projectTitle, stages, evidence, reportsDir, stagesDir, finalOutput, generatedAt }) {
  const stageOutputs = [];
  const stageReports = stages.map((stage) => {
    const filename = stageOutputFilename(stage);
    const targetPath = join(stagesDir, filename);
    const artifacts = stage.artifacts.map((item) => ({
      ...item,
      outputHref: item.kind === 'html' ? portable(relative(stagesDir, item.path)) : '',
    }));
    stageOutputs.push({ stageId: stage.id, path: portable(relative(reportsDir, targetPath)) });
    return {
      filename,
      content: renderStageReport({ projectTitle, stage: { ...stage, artifacts }, generatedAt }),
    };
  });

  const finalStages = stages.map((stage) => ({
    ...stage,
    artifacts: stage.artifacts.map((item) => ({
      ...item,
      outputHref: item.kind === 'html' ? portable(relative(reportsDir, item.path)) : '',
    })),
  }));
  const finalContent = renderFinalReport({
    projectTitle,
    stages: finalStages,
    generatedAt,
    sourceCount: evidence.length,
  });
  const sources = evidence.map((item) => ({
    stage: item.stageId || 'support',
    path: item.relativePath,
    kind: item.kind,
    sha256: item.sha256,
  }));
  const manifest = {
    schemaVersion: 2,
    project: projectTitle,
    ...(generatedAt ? { generatedAt } : {}),
    output: basename(finalOutput),
    files: sources.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
    sources,
    stageReports: stageOutputs,
  };
  return {
    stageReports,
    stageOutputs,
    finalContent,
    manifestContent: `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

export async function generateReport({
  projectRoot,
  specRoot,
  output,
  layoutPath,
  title,
  includes = [],
  generatedAt = '',
}) {
  validateOptions({ projectRoot, specRoot, output, layoutPath, title, includes, generatedAt });
  const boundary = await createReportPathBoundary(resolve(projectRoot));
  const project = boundary.project;
  const spec = resolve(specRoot === undefined ? join(project, 'spec') : specRoot);
  const finalOutput = resolve(output === undefined ? join(project, 'report', 'omnipotens-final.html') : output);
  if (extname(finalOutput).toLocaleLowerCase('en-US') !== '.html') {
    throw new Error(`Final report output must use the .html extension: ${finalOutput}`);
  }
  const reportsDir = dirname(finalOutput);
  const stagesDir = join(reportsDir, 'stages');
  const manifestPath = join(reportsDir, 'omnipotens-final.manifest.json');
  const selectedLayoutPath = resolve(layoutPath === undefined
    ? join(spec, 'data', 'omnipotens-report-layout.json')
    : layoutPath);
  const resolvedIncludes = includes.map((item) => resolve(item));
  const publicationTargets = { reportsDir, finalOutput, manifestPath, stagesDir };

  const specInspection = await boundary.assertOptionalDirectory(spec, 'Report spec directory');
  if (specRoot !== undefined && !specInspection.exists) {
    throw new Error(`Explicit report spec directory does not exist: ${spec}`);
  }
  await validatePublicationTargets(boundary, publicationTargets);
  assertInputDoesNotOverlapPublication(selectedLayoutPath, 'Report layout', publicationTargets);
  for (const include of resolvedIncludes) {
    assertInputDoesNotOverlapPublication(include, 'Explicit report include', publicationTargets);
  }

  const inputModel = await buildReportInputModel({
    boundary,
    project,
    spec,
    reportsDir,
    output: finalOutput,
    manifestPath,
    layoutPath: selectedLayoutPath,
    isExplicitLayout: layoutPath !== undefined,
    includes: resolvedIncludes,
  });
  for (const evidence of inputModel.evidence) {
    assertInputDoesNotOverlapPublication(evidence.path, 'Report evidence', publicationTargets);
  }

  const projectTitle = title || basename(project);
  const effectiveGeneratedAt = generatedAt || inputModel.layoutGeneratedAt || '';
  const generation = renderGeneration({
    projectTitle,
    stages: inputModel.stages,
    evidence: inputModel.evidence,
    reportsDir,
    stagesDir,
    finalOutput,
    generatedAt: effectiveGeneratedAt,
  });
  await publishReportGeneration({
    ...publicationTargets,
    finalContent: generation.finalContent,
    manifestContent: generation.manifestContent,
    stageReports: generation.stageReports,
    validateTargets: () => validatePublicationTargets(boundary, publicationTargets),
  });

  return {
    output: finalOutput,
    manifest: manifestPath,
    stages: inputModel.stages.length,
    sources: inputModel.evidence.length,
    stageOutputs: generation.stageOutputs,
  };
}
