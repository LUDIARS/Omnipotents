import { createHash } from 'node:crypto';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { discoverFiles, discoverTopLevelFiles } from './files.mjs';
import { windowsSafePathKey } from './report-path-boundary.mjs';
import { enrichArtifact } from './report-renderer.mjs';

const ARTIFACT_KINDS = new Map([
  ['.md', 'markdown'],
  ['.html', 'html'],
  ['.json', 'json'],
]);
const SAFE_STAGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_STAGE_SLUG_LENGTH = 80;

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function portable(value) {
  return value.replace(/\\/g, '/');
}

function stageIdKey(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

function titleWithoutId(title) {
  return String(title).replace(/^\d{2}\.\s*/, '').trim();
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function validatePathList(value, label, { required }) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new Error(`${label} must be ${required ? 'a non-empty' : 'an'} array.`);
  }
  return value.map((item, index) => requireNonEmptyString(item, `${label}[${index}]`));
}

function validateLayout(rawLayout) {
  if (!rawLayout || typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
    throw new Error('Report layout must be a JSON object.');
  }
  if (!Array.isArray(rawLayout.sections) || rawLayout.sections.length === 0) {
    throw new Error('Report layout must contain a non-empty sections array.');
  }
  if (rawLayout.generatedAt !== undefined && typeof rawLayout.generatedAt !== 'string') {
    throw new Error('Report layout generatedAt must be a string when provided.');
  }

  const seenIds = new Map();
  const sections = rawLayout.sections.map((section, index) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw new Error(`Report layout section ${index + 1} must be an object.`);
    }
    const id = requireNonEmptyString(section.id, `Report layout section ${index + 1} id`);
    if (!SAFE_STAGE_ID.test(id)) {
      throw new Error(`Unsafe report section id: ${id}. Use 1-64 ASCII letters, digits, underscores, or hyphens.`);
    }
    const idKey = stageIdKey(id);
    const conflictingId = seenIds.get(idKey);
    if (conflictingId) {
      throw new Error(`Duplicate report section id (case-insensitive): ${conflictingId} / ${id}`);
    }
    seenIds.set(idKey, id);

    const displayTitle = requireNonEmptyString(section.title, `Report layout section ${id} title`);
    const title = titleWithoutId(displayTitle);
    if (!title) throw new Error(`Report layout section ${id} title must not contain only its id.`);
    return {
      id,
      title,
      sources: validatePathList(section.sources, `Report layout section ${id} sources`, { required: true }),
      artifacts: section.artifacts === undefined
        ? []
        : validatePathList(section.artifacts, `Report layout section ${id} artifacts`, { required: false }),
    };
  });
  return { sections, generatedAt: rawLayout.generatedAt ?? '' };
}

async function loadLayout({ boundary, layoutPath, isExplicit }) {
  const exists = await boundary.pathExists(layoutPath, 'Report layout');
  if (!exists) {
    if (isExplicit) throw new Error(`Explicit report layout does not exist: ${layoutPath}`);
    return null;
  }
  const content = await boundary.readTextFile(layoutPath, 'Report layout');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid report layout JSON: ${layoutPath}`, { cause: error });
  }
  return validateLayout(parsed);
}

function artifactKind(filePath) {
  const kind = ARTIFACT_KINDS.get(extname(filePath).toLowerCase());
  if (!kind) throw new Error(`Unsupported report artifact: ${filePath}`);
  return kind;
}

async function readArtifact({ boundary, project, filePath, stageId, stageTitle, explicit = false }) {
  const kind = artifactKind(filePath);
  const content = await boundary.readTextFile(filePath, 'Report artifact');
  const artifact = {
    stageId,
    stageTitle,
    path: filePath,
    relativePath: portable(relative(project, filePath)),
    name: basename(filePath),
    kind,
    explicit,
  };
  try {
    return { ...enrichArtifact(artifact, content), sha256: sha256(content) };
  } catch (error) {
    throw new Error(`Invalid ${kind} report artifact: ${filePath}`, { cause: error });
  }
}

async function safeDiscover(boundary, root, extensions, label) {
  if (!(await boundary.pathExists(root, label))) return [];
  await boundary.assertExistingDirectory(root, label);
  return discoverFiles(root, extensions);
}

async function safeDiscoverTopLevel(boundary, root, extensions, label) {
  if (!(await boundary.pathExists(root, label))) return [];
  await boundary.assertExistingDirectory(root, label);
  return discoverTopLevelFiles(root, extensions);
}

async function buildLayoutStages({ boundary, project, layout }) {
  const stages = [];
  for (const section of layout.sections) {
    const artifacts = [];
    for (const source of [...section.sources, ...section.artifacts]) {
      const filePath = boundary.resolveProjectPath(source, `Report layout source ${source}`);
      artifacts.push(await readArtifact({
        boundary,
        project,
        filePath,
        stageId: section.id,
        stageTitle: section.title,
      }));
    }
    stages.push({ id: section.id, title: section.title, artifacts });
  }
  return stages;
}

function mergeRelatedArtifacts(stages, artifacts) {
  if (artifacts.length === 0) return;
  const stagedPaths = new Set(stages.flatMap((stage) => stage.artifacts.map((item) => windowsSafePathKey(item.path))));
  const additions = artifacts.filter((item) => {
    const key = windowsSafePathKey(item.path);
    if (stagedPaths.has(key)) return false;
    stagedPaths.add(key);
    return true;
  });
  if (additions.length === 0) return;

  const related = stages.find((stage) => stageIdKey(stage.id) === '99');
  if (related) {
    related.artifacts.push(...additions.map((item) => ({ ...item, stageId: related.id, stageTitle: related.title })));
    return;
  }
  stages.push({
    id: '99',
    title: '関連レポート',
    artifacts: additions.map((item) => ({ ...item, stageId: '99', stageTitle: '関連レポート' })),
  });
}

async function readRelatedArtifacts({ boundary, project, paths }) {
  const artifacts = [];
  const seen = new Set();
  for (const filePath of paths) {
    const key = windowsSafePathKey(filePath);
    if (seen.has(key)) continue;
    seen.add(key);
    artifacts.push(await readArtifact({
      boundary,
      project,
      filePath,
      stageId: '99',
      stageTitle: '関連レポート',
      explicit: true,
    }));
  }
  return artifacts;
}

async function topLevelReportInputs({ boundary, reportsDir, output, manifestPath }) {
  const excluded = new Set([windowsSafePathKey(output), windowsSafePathKey(manifestPath)]);
  return (await safeDiscoverTopLevel(boundary, reportsDir, ['.html', '.json'], 'Report output directory'))
    .filter((filePath) => !excluded.has(windowsSafePathKey(filePath)));
}

async function buildFallbackStages({ boundary, project, spec, topLevelInputs, includes }) {
  const markdownFiles = await safeDiscover(boundary, spec, ['.md'], 'Report spec directory');
  const stages = [];
  for (let index = 0; index < markdownFiles.length; index += 1) {
    const id = String(index + 1).padStart(2, '0');
    const artifact = await readArtifact({
      boundary,
      project,
      filePath: markdownFiles[index],
      stageId: id,
      stageTitle: '',
    });
    stages.push({ id, title: artifact.title, artifacts: [{ ...artifact, stageTitle: artifact.title }] });
  }
  mergeRelatedArtifacts(stages, await readRelatedArtifacts({
    boundary,
    project,
    paths: [...topLevelInputs, ...includes],
  }));
  return stages;
}

function uniqueByPath(items) {
  const unique = new Map();
  for (const item of items) unique.set(windowsSafePathKey(item.path), item);
  return [...unique.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function slug(value) {
  const fullSlug = String(value)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLocaleLowerCase('en-US') || 'report';
  return Array.from(fullSlug).slice(0, MAX_STAGE_SLUG_LENGTH).join('').replace(/-$/g, '') || 'report';
}

export function stageOutputFilename(stage) {
  if (!stage || typeof stage.id !== 'string' || !SAFE_STAGE_ID.test(stage.id)) {
    throw new Error(`Unsafe report stage id: ${String(stage?.id)}`);
  }
  return `${stage.id}-${slug(stage.title)}.html`;
}

function validateStageOutputNames(stages) {
  const ids = new Map();
  const filenames = new Map();
  for (const stage of stages) {
    const idKey = stageIdKey(stage.id);
    const conflictingId = ids.get(idKey);
    if (conflictingId) throw new Error(`Duplicate report stage id (case-insensitive): ${conflictingId} / ${stage.id}`);
    ids.set(idKey, stage.id);

    const filename = stageOutputFilename(stage);
    const filenameKey = filename.normalize('NFKC').toLocaleLowerCase('en-US');
    const conflictingFilename = filenames.get(filenameKey);
    if (conflictingFilename) {
      throw new Error(`Report stage filenames collide on Windows: ${conflictingFilename} / ${filename}`);
    }
    filenames.set(filenameKey, filename);
  }
}

async function validateIncludes(boundary, includes) {
  for (const include of includes) {
    await boundary.assertExistingFile(include, 'Explicit report include');
    artifactKind(include);
  }
}

export async function buildReportInputModel({
  boundary,
  project,
  spec,
  reportsDir,
  output,
  manifestPath,
  layoutPath,
  isExplicitLayout,
  includes,
}) {
  await validateIncludes(boundary, includes);
  const layout = await loadLayout({ boundary, layoutPath, isExplicit: isExplicitLayout });
  const topLevelInputs = await topLevelReportInputs({ boundary, reportsDir, output, manifestPath });
  const stages = layout
    ? await buildLayoutStages({ boundary, project, layout })
    : await buildFallbackStages({ boundary, project, spec, topLevelInputs, includes });

  if (layout) {
    mergeRelatedArtifacts(stages, await readRelatedArtifacts({ boundary, project, paths: includes }));
  }
  if (stages.length === 0) {
    throw new Error(`No Omnipotens artifacts found under ${spec}. Refusing to create an empty report.`);
  }
  validateStageOutputNames(stages);

  const specEvidence = await safeDiscover(boundary, spec, ['.md', '.html', '.json'], 'Report spec directory');
  const stagedArtifacts = stages.flatMap((stage) => stage.artifacts);
  const evidence = [...stagedArtifacts];
  const stagedPaths = new Set(stagedArtifacts.map((item) => windowsSafePathKey(item.path)));
  for (const filePath of [...specEvidence, ...topLevelInputs, ...includes]) {
    if (stagedPaths.has(windowsSafePathKey(filePath))) continue;
    evidence.push(await readArtifact({ boundary, project, filePath, stageId: '', stageTitle: '' }));
  }

  return {
    stages,
    evidence: uniqueByPath(evidence),
    layoutGeneratedAt: layout?.generatedAt ?? '',
  };
}
