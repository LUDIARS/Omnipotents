import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { discoverFiles } from './files.mjs';
import { enrichArtifact, renderFinalReport, renderStageReport } from './report-renderer.mjs';

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const kinds = new Map([['.md', 'markdown'], ['.html', 'html'], ['.json', 'json']]);

function portable(value) {
  return value.replace(/\\/g, '/');
}

function slug(value) {
  return String(value)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'report';
}

function titleWithoutId(title) {
  return String(title).replace(/^\d{2}\.\s*/, '').trim();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveProjectFile(project, input) {
  const filePath = resolve(project, input);
  const projectRelative = relative(project, filePath);
  if (!projectRelative || projectRelative.startsWith('..') || resolve(project, projectRelative) !== filePath) {
    throw new Error(`Report source must be inside the project: ${input}`);
  }
  return filePath;
}

async function loadLayout(layoutPath) {
  if (!(await exists(layoutPath))) return null;
  const layout = JSON.parse(await readFile(layoutPath, 'utf8'));
  if (!Array.isArray(layout.sections) || layout.sections.length === 0) {
    throw new Error('Report layout must contain a non-empty sections array.');
  }
  return layout;
}

async function readArtifact({ project, filePath, stageId, stageTitle, explicit = false }) {
  const kind = kinds.get(extname(filePath).toLowerCase());
  if (!kind) throw new Error(`Unsupported report artifact: ${filePath}`);
  const content = await readFile(filePath, 'utf8');
  const artifact = {
    stageId,
    stageTitle,
    path: filePath,
    relativePath: portable(relative(project, filePath)),
    name: basename(filePath),
    kind,
    explicit,
  };
  return { ...enrichArtifact(artifact, content), sha256: sha256(content) };
}

async function safeDiscover(root, extensions) {
  if (!(await exists(root))) return [];
  return discoverFiles(root, extensions);
}

async function buildLayoutStages({ project, layout }) {
  const stages = [];
  const seenIds = new Set();
  for (const section of layout.sections) {
    const id = String(section.id ?? '').trim();
    const displayTitle = String(section.title ?? '').trim();
    const title = titleWithoutId(displayTitle);
    if (!id || !title || !Array.isArray(section.sources) || section.sources.length === 0) {
      throw new Error('Each report layout section requires id, title, and sources.');
    }
    if (seenIds.has(id)) throw new Error(`Duplicate report section id: ${id}`);
    seenIds.add(id);
    const paths = [...section.sources, ...(Array.isArray(section.artifacts) ? section.artifacts : [])];
    const artifacts = [];
    for (const source of paths) {
      const filePath = resolveProjectFile(project, source);
      if (!(await exists(filePath))) throw new Error(`Report layout source does not exist: ${source}`);
      artifacts.push(await readArtifact({ project, filePath, stageId: id, stageTitle: title }));
    }
    stages.push({ id, title, artifacts });
  }
  return stages;
}

async function buildFallbackStages({ project, spec, reportsDir, output, includes }) {
  const markdownFiles = await safeDiscover(spec, ['.md']);
  const stages = [];
  for (let index = 0; index < markdownFiles.length; index += 1) {
    const id = String(index + 1).padStart(2, '0');
    const artifact = await readArtifact({ project, filePath: markdownFiles[index], stageId: id, stageTitle: '' });
    stages.push({ id, title: artifact.title, artifacts: [{ ...artifact, stageTitle: artifact.title }] });
  }
  const topLevel = (await safeDiscover(reportsDir, ['.html', '.json'])).filter((filePath) =>
    dirname(filePath) === reportsDir
    && resolve(filePath) !== resolve(output)
    && basename(filePath) !== 'omnipotens-final.manifest.json'
  );
  const extraPaths = [...topLevel, ...includes.map((item) => resolve(item))];
  if (extraPaths.length) {
    const artifacts = [];
    for (const filePath of extraPaths) {
      if (await exists(filePath)) artifacts.push(await readArtifact({ project, filePath, stageId: '99', stageTitle: '関連レポート', explicit: true }));
    }
    if (artifacts.length) stages.push({ id: '99', title: '関連レポート', artifacts });
  }
  return stages;
}

function uniqueByPath(items) {
  const unique = new Map();
  for (const item of items) unique.set(resolve(item.path).toLowerCase(), item);
  return [...unique.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
  const project = resolve(projectRoot);
  const spec = resolve(specRoot ?? join(project, 'spec'));
  const finalOutput = resolve(output ?? join(project, 'report', 'omnipotens-final.html'));
  const reportsDir = dirname(finalOutput);
  const stagesDir = join(reportsDir, 'stages');
  const selectedLayoutPath = resolve(layoutPath ?? join(spec, 'data', 'omnipotens-report-layout.json'));
  const layout = await loadLayout(selectedLayoutPath);
  const projectTitle = title || basename(project);
  const effectiveGeneratedAt = generatedAt || layout?.generatedAt || '';

  const stages = layout
    ? await buildLayoutStages({ project, layout })
    : await buildFallbackStages({ project, spec, reportsDir, output: finalOutput, includes });
  if (stages.length === 0) throw new Error(`No Omnipotens artifacts found under ${spec}. Refusing to create an empty report.`);

  await rm(stagesDir, { recursive: true, force: true });
  await mkdir(stagesDir, { recursive: true });
  const stageOutputs = [];
  for (const stage of stages) {
    const filename = `${stage.id}-${slug(stage.title)}.html`;
    const stageOutput = join(stagesDir, filename);
    const artifacts = stage.artifacts.map((item) => ({
      ...item,
      outputHref: item.kind === 'html' ? portable(relative(stagesDir, item.path)) : '',
    }));
    await writeFile(stageOutput, renderStageReport({ projectTitle, stage: { ...stage, artifacts }, generatedAt: effectiveGeneratedAt }), 'utf8');
    stageOutputs.push({ stageId: stage.id, path: portable(relative(reportsDir, stageOutput)) });
  }

  const finalStages = stages.map((stage) => ({
    ...stage,
    artifacts: stage.artifacts.map((item) => ({
      ...item,
      outputHref: item.kind === 'html' ? portable(relative(reportsDir, item.path)) : '',
    })),
  }));

  const specEvidence = await safeDiscover(spec, ['.md', '.html', '.json']);
  const topLevelEvidence = (await safeDiscover(reportsDir, ['.html', '.json'])).filter((filePath) =>
    dirname(filePath) === reportsDir
    && resolve(filePath) !== finalOutput
    && basename(filePath) !== 'omnipotens-final.manifest.json'
  );
  const stagedArtifacts = stages.flatMap((stage) => stage.artifacts);
  const evidence = [...stagedArtifacts];
  const stagedPaths = new Set(stagedArtifacts.map((item) => resolve(item.path).toLowerCase()));
  for (const filePath of [...specEvidence, ...topLevelEvidence, ...includes.map((item) => resolve(item))]) {
    if (!(await exists(filePath)) || stagedPaths.has(resolve(filePath).toLowerCase())) continue;
    evidence.push(await readArtifact({ project, filePath, stageId: '', stageTitle: '' }));
  }
  const uniqueEvidence = uniqueByPath(evidence);

  await mkdir(reportsDir, { recursive: true });
  await writeFile(finalOutput, renderFinalReport({
    projectTitle,
    stages: finalStages,
    generatedAt: effectiveGeneratedAt,
    sourceCount: uniqueEvidence.length,
  }), 'utf8');

  const manifestPath = join(reportsDir, 'omnipotens-final.manifest.json');
  const sources = uniqueEvidence.map((item) => ({
    stage: item.stageId || 'support',
    path: item.relativePath,
    kind: item.kind,
    sha256: item.sha256,
  }));
  const manifest = {
    schemaVersion: 2,
    project: projectTitle,
    ...(effectiveGeneratedAt ? { generatedAt: effectiveGeneratedAt } : {}),
    output: basename(finalOutput),
    files: sources.map(({ path, sha256: hash }) => ({ path, sha256: hash })),
    sources,
    stageReports: stageOutputs,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { output: finalOutput, manifest: manifestPath, stages: stages.length, sources: uniqueEvidence.length, stageOutputs };
}
