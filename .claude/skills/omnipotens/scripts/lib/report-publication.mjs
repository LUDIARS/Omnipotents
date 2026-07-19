import {
  lstat,
  mkdir,
  mkdtemp,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

const DEFAULT_OPERATIONS = Object.freeze({ lstat, mkdir, mkdtemp, rename, rm, rmdir, writeFile });
const MISSING_PATH_CODES = new Set(['ENOENT', 'ENOTDIR']);
const LOCK_DIRECTORY_NAME = '.omnipotens-report.lock';

class ReportRollbackError extends AggregateError {}

function operationsWith(overrides) {
  if (overrides === undefined) return DEFAULT_OPERATIONS;
  if (!overrides || typeof overrides !== 'object') throw new TypeError('Publication operations must be an object.');
  return { ...DEFAULT_OPERATIONS, ...overrides };
}

async function pathExists(operations, path) {
  try {
    await operations.lstat(path);
    return true;
  } catch (error) {
    if (MISSING_PATH_CODES.has(error?.code)) return false;
    throw error;
  }
}

function validateStageReports(stageReports) {
  if (!Array.isArray(stageReports) || stageReports.length === 0) {
    throw new Error('Publication requires at least one stage report.');
  }
  const filenames = new Map();
  for (const [index, report] of stageReports.entries()) {
    if (!report || typeof report !== 'object') throw new Error(`Stage report ${index + 1} must be an object.`);
    if (typeof report.filename !== 'string'
      || report.filename.length === 0
      || basename(report.filename) !== report.filename
      || !report.filename.toLocaleLowerCase('en-US').endsWith('.html')) {
      throw new Error(`Unsafe stage report filename: ${String(report.filename)}`);
    }
    if (typeof report.content !== 'string') throw new Error(`Stage report ${report.filename} content must be a string.`);
    const key = report.filename.normalize('NFKC').toLocaleLowerCase('en-US');
    const conflict = filenames.get(key);
    if (conflict) throw new Error(`Stage report filenames collide on Windows: ${conflict} / ${report.filename}`);
    filenames.set(key, report.filename);
  }
}

async function acquireLock(operations, lockPath) {
  try {
    await operations.mkdir(lockPath);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Another report publication is active, or a stale lock exists: ${lockPath}`, { cause: error });
    }
    throw error;
  }
}

async function rollback(items, operations) {
  const errors = [];
  for (const item of [...items].reverse()) {
    if (!item.published) continue;
    try {
      await operations.rename(item.target, item.staged);
      item.published = false;
    } catch (error) {
      errors.push(new Error(`Could not remove partially published ${item.name}.`, { cause: error }));
    }
  }
  for (const item of [...items].reverse()) {
    if (!item.backedUp) continue;
    try {
      await operations.rename(item.backup, item.target);
      item.backedUp = false;
    } catch (error) {
      errors.push(new Error(`Could not restore previous ${item.name}.`, { cause: error }));
    }
  }
  return errors;
}

async function swapGeneration({ operations, items, backupRoot }) {
  try {
    for (const item of items) {
      if (!(await pathExists(operations, item.target))) continue;
      await operations.rename(item.target, item.backup);
      item.backedUp = true;
    }
    for (const item of items) {
      await operations.rename(item.staged, item.target);
      item.published = true;
    }
  } catch (publicationError) {
    const rollbackErrors = await rollback(items, operations);
    if (rollbackErrors.length > 0) {
      throw new ReportRollbackError(
        [publicationError, ...rollbackErrors],
        `Report publication failed and rollback was incomplete. Previous files are preserved under ${backupRoot}.`,
      );
    }
    throw publicationError;
  }
}

async function removeTreeIfPresent(operations, path) {
  if (!(await pathExists(operations, path))) return;
  await operations.rm(path, { recursive: true, force: false });
}

export async function publishReportGeneration({
  reportsDir,
  finalOutput,
  manifestPath,
  summaryOutputPath,
  stagesDir,
  finalContent,
  manifestContent,
  summaryContent,
  stageReports,
  validateTargets = async () => {},
  operations: operationOverrides,
}) {
  if (typeof finalContent !== 'string' || typeof manifestContent !== 'string' || typeof summaryContent !== 'string') {
    throw new TypeError('Final report, manifest, and summary publication content must be strings.');
  }
  if (typeof validateTargets !== 'function') throw new TypeError('validateTargets must be a function.');
  validateStageReports(stageReports);

  const operations = operationsWith(operationOverrides);
  const lockPath = join(reportsDir, LOCK_DIRECTORY_NAME);
  let lockAcquired = false;
  let stagingRoot;
  let backupRoot;
  let preserveBackup = false;
  let primaryError;

  try {
    await operations.mkdir(reportsDir, { recursive: true });
    await validateTargets();
    await acquireLock(operations, lockPath);
    lockAcquired = true;
    await validateTargets();

    stagingRoot = await operations.mkdtemp(join(reportsDir, '.omnipotens-report-staging-'));
    const stagedStages = join(stagingRoot, 'stages');
    const stagedFinal = join(stagingRoot, 'final.html');
    const stagedManifest = join(stagingRoot, 'manifest.json');
    const stagedSummary = join(stagingRoot, 'summary.json');
    await operations.mkdir(stagedStages);
    for (const report of stageReports) {
      await operations.writeFile(join(stagedStages, report.filename), report.content, { encoding: 'utf8', flag: 'wx' });
    }
    await operations.writeFile(stagedFinal, finalContent, { encoding: 'utf8', flag: 'wx' });
    await operations.writeFile(stagedManifest, manifestContent, { encoding: 'utf8', flag: 'wx' });
    await operations.writeFile(stagedSummary, summaryContent, { encoding: 'utf8', flag: 'wx' });

    await validateTargets();
    backupRoot = await operations.mkdtemp(join(reportsDir, '.omnipotens-report-backup-'));
    const items = [
      {
        name: 'stage reports',
        staged: stagedStages,
        target: stagesDir,
        backup: join(backupRoot, 'stages'),
        backedUp: false,
        published: false,
      },
      {
        name: 'final report',
        staged: stagedFinal,
        target: finalOutput,
        backup: join(backupRoot, 'final.html'),
        backedUp: false,
        published: false,
      },
      {
        name: 'analysis summary',
        staged: stagedSummary,
        target: summaryOutputPath,
        backup: join(backupRoot, 'summary.json'),
        backedUp: false,
        published: false,
      },
      {
        name: 'manifest',
        staged: stagedManifest,
        target: manifestPath,
        backup: join(backupRoot, 'manifest.json'),
        backedUp: false,
        published: false,
      },
    ];
    try {
      await swapGeneration({ operations, items, backupRoot });
    } catch (error) {
      preserveBackup = error instanceof ReportRollbackError;
      throw error;
    }
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors = [];
  if (stagingRoot) {
    try {
      await removeTreeIfPresent(operations, stagingRoot);
    } catch (error) {
      cleanupErrors.push(new Error(`Could not remove report staging directory: ${stagingRoot}`, { cause: error }));
    }
  }
  if (backupRoot && !preserveBackup) {
    try {
      await removeTreeIfPresent(operations, backupRoot);
    } catch (error) {
      cleanupErrors.push(new Error(`Could not remove report backup directory: ${backupRoot}`, { cause: error }));
    }
  }
  if (lockAcquired) {
    try {
      await operations.rmdir(lockPath);
    } catch (error) {
      cleanupErrors.push(new Error(`Could not release report publication lock: ${lockPath}`, { cause: error }));
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors,
      primaryError ? 'Report publication and cleanup failed.' : 'Report publication cleanup failed.',
    );
  }
  if (primaryError) throw primaryError;
}
