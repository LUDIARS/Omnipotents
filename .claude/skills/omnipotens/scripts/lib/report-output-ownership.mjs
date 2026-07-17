import { readdir } from 'node:fs/promises';
import { basename, isAbsolute, posix, relative } from 'node:path';

function portable(value) {
  return value.replaceAll('\\', '/');
}

function isOwnedStagePath(value, stagesPrefix) {
  if (typeof value !== 'string' || value.includes('\\') || isAbsolute(value)) return false;
  const normalized = posix.normalize(value);
  return normalized === value
    && normalized.startsWith(stagesPrefix)
    && posix.dirname(normalized) === stagesPrefix.slice(0, -1)
    && posix.basename(normalized) !== ''
    && !normalized.endsWith('/');
}

function pathKey(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

function validateOwnershipManifest(manifest, { reportsDir, finalOutput, stagesDir, manifestPath }) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || manifest.schemaVersion !== 2) {
    throw new Error(`Existing report outputs have no supported ownership manifest: ${manifestPath}`);
  }
  if (manifest.output !== basename(finalOutput)) {
    throw new Error(
      `Existing report manifest owns '${String(manifest.output)}', not requested output '${basename(finalOutput)}'.`,
    );
  }
  if (!Array.isArray(manifest.sources) || !Array.isArray(manifest.files)) {
    throw new Error(`Existing report ownership manifest is incomplete: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.stageReports) || manifest.stageReports.length === 0) {
    throw new Error(`Existing report ownership manifest has no stage reports: ${manifestPath}`);
  }

  const relativeStages = portable(relative(reportsDir, stagesDir));
  const stagesPrefix = `${relativeStages}/`;
  if (
    relativeStages === ''
    || relativeStages === '..'
    || relativeStages.startsWith('../')
    || isAbsolute(relativeStages)
    || manifest.stageReports.some((report) => !report || !isOwnedStagePath(report.path, stagesPrefix))
  ) {
    throw new Error(`Existing report manifest does not own the requested stages directory: ${stagesDir}`);
  }
  const stagePaths = manifest.stageReports.map((report) => report.path);
  const keys = new Set(stagePaths.map(pathKey));
  if (keys.size !== stagePaths.length) {
    throw new Error(`Existing report ownership manifest has duplicate stage paths: ${manifestPath}`);
  }
  return { stagesPrefix, expectedStagePathKeys: keys };
}

async function assertOwnedStageDirectory(stagesDir, ownership) {
  const entries = await readdir(stagesDir, { withFileTypes: true });
  const actualKeys = new Set();
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Existing report stages contain an unowned filesystem entry: ${entry.name}`);
    }
    actualKeys.add(pathKey(`${ownership.stagesPrefix}${entry.name}`));
  }
  if (
    actualKeys.size !== ownership.expectedStagePathKeys.size
    || [...actualKeys].some((key) => !ownership.expectedStagePathKeys.has(key))
  ) {
    throw new Error(`Existing report stages do not match their ownership manifest: ${stagesDir}`);
  }
}

export async function assertReportOutputOwnership({
  boundary,
  reportsDir,
  finalOutput,
  manifestPath,
  stagesDir,
}) {
  const [finalExists, manifestExists, stagesExist] = await Promise.all([
    boundary.pathExists(finalOutput, 'Final report output'),
    boundary.pathExists(manifestPath, 'Report manifest output'),
    boundary.pathExists(stagesDir, 'Report stages output directory'),
  ]);
  if (!finalExists && !manifestExists && !stagesExist) return;
  if (!finalExists || !manifestExists || !stagesExist) {
    throw new Error(
      `Refusing to replace an incomplete or unowned report generation: ${manifestPath}`,
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(await boundary.readTextFile(manifestPath, 'Report ownership manifest'));
  } catch (error) {
    throw new Error(`Existing report ownership manifest is invalid: ${manifestPath}`, { cause: error });
  }
  const ownership = validateOwnershipManifest(manifest, { reportsDir, finalOutput, stagesDir, manifestPath });
  await assertOwnedStageDirectory(stagesDir, ownership);
}
