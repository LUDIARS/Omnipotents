import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const MISSING_PATH_CODES = new Set(['ENOENT', 'ENOTDIR']);

function requirePathValue(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new TypeError(`${label} must be a non-empty path string.`);
  }
  return value;
}

function isWithin(root, candidate, allowRoot = true) {
  const pathFromRoot = relative(root, candidate);
  if (pathFromRoot === '') return allowRoot;
  return !isAbsolute(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`);
}

function assertWithin(root, candidate, label, allowRoot = true) {
  if (!isWithin(root, candidate, allowRoot)) {
    throw new Error(`${label} must be inside the project: ${candidate}`);
  }
}

async function lstatIfPresent(path) {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if (MISSING_PATH_CODES.has(error?.code)) return null;
    throw error;
  }
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.isFile() === right.isFile();
}

function assertExpectedKind(stats, expectedKind, label, path) {
  if (expectedKind === 'file' && !stats.isFile()) {
    throw new Error(`${label} must be a regular file: ${path}`);
  }
  if (expectedKind === 'directory' && !stats.isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`);
  }
}

export function windowsSafePathKey(value) {
  return resolve(value).normalize('NFKC').toLocaleLowerCase('en-US');
}

export async function createReportPathBoundary(projectRoot) {
  const project = resolve(requirePathValue(projectRoot, 'Project root'));
  const projectStats = await lstatIfPresent(project);
  if (!projectStats) throw new Error(`Project root does not exist: ${project}`);
  if (projectStats.isSymbolicLink()) {
    throw new Error(`Project root must not be a symbolic link or junction: ${project}`);
  }
  if (!projectStats.isDirectory()) throw new Error(`Project root must be a directory: ${project}`);
  const canonicalProject = await realpath(project);

  function resolveProjectPath(input, label = 'Report path') {
    const candidate = resolve(project, requirePathValue(input, label));
    assertWithin(project, candidate, label, false);
    return candidate;
  }

  async function inspect(input, {
    label = 'Report path',
    mustExist = true,
    expectedKind,
    allowProjectRoot = true,
  } = {}) {
    const candidate = resolve(requirePathValue(input, label));
    assertWithin(project, candidate, label, allowProjectRoot);

    const projectRelative = relative(project, candidate);
    const components = projectRelative === '' ? [] : projectRelative.split(sep);
    let current = project;
    let lastExisting = project;
    let currentStats = projectStats;
    for (const [index, component] of components.entries()) {
      current = join(current, component);
      currentStats = await lstatIfPresent(current);
      if (!currentStats) {
        if (mustExist) throw new Error(`${label} does not exist: ${candidate}`);
        const canonicalParent = await realpath(lastExisting);
        assertWithin(canonicalProject, canonicalParent, label);
        return { path: candidate, exists: false, stats: null };
      }
      if (currentStats.isSymbolicLink()) {
        throw new Error(`${label} must not traverse a symbolic link or junction: ${current}`);
      }
      if (index < components.length - 1 && !currentStats.isDirectory()) {
        throw new Error(`${label} has a non-directory parent: ${current}`);
      }
      lastExisting = current;
    }

    if (currentStats.isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link or junction: ${candidate}`);
    }
    assertExpectedKind(currentStats, expectedKind, label, candidate);

    const canonicalCandidate = await realpath(candidate);
    assertWithin(canonicalProject, canonicalCandidate, label, allowProjectRoot);
    return { path: candidate, exists: true, stats: currentStats };
  }

  async function readVerifiedFile(input, label, encoding) {
    const inspected = await inspect(input, { label, expectedKind: 'file' });
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const handle = await open(inspected.path, constants.O_RDONLY | noFollow);
    try {
      const openedStats = await handle.stat({ bigint: true });
      if (!sameFileIdentity(inspected.stats, openedStats)) {
        throw new Error(`${label} changed between validation and open: ${inspected.path}`);
      }
      const pathStats = await lstatIfPresent(inspected.path);
      if (!pathStats || pathStats.isSymbolicLink() || !sameFileIdentity(openedStats, pathStats)) {
        throw new Error(`${label} changed after open: ${inspected.path}`);
      }
      const canonicalPath = await realpath(inspected.path);
      assertWithin(canonicalProject, canonicalPath, label);
      return encoding === undefined ? handle.readFile() : handle.readFile({ encoding });
    } finally {
      await handle.close();
    }
  }

  return Object.freeze({
    project,
    canonicalProject,
    resolveProjectPath,
    async pathExists(input, label = 'Report path') {
      return (await inspect(input, { label, mustExist: false })).exists;
    },
    async assertExistingFile(input, label = 'Report input') {
      return (await inspect(input, { label, expectedKind: 'file' })).path;
    },
    async assertExistingDirectory(input, label = 'Report directory') {
      return (await inspect(input, { label, expectedKind: 'directory' })).path;
    },
    async assertOptionalDirectory(input, label = 'Report directory') {
      return inspect(input, { label, mustExist: false, expectedKind: 'directory' });
    },
    async assertOutputFile(input, label = 'Report output') {
      return inspect(input, { label, mustExist: false, expectedKind: 'file', allowProjectRoot: false });
    },
    async assertOutputDirectory(input, label = 'Report output directory') {
      return inspect(input, { label, mustExist: false, expectedKind: 'directory' });
    },
    async readTextFile(input, label = 'Report input') {
      return readVerifiedFile(input, label, 'utf8');
    },
  });
}
