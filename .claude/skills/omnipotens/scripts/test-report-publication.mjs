import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename as fsRename,
  rm,
  writeFile as fsWriteFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { publishReportGeneration } from './lib/report-publication.mjs';

async function seedPreviousGeneration(reportDir) {
  const stagesDir = join(reportDir, 'stages');
  const finalOutput = join(reportDir, 'omnipotens-final.html');
  const manifestPath = join(reportDir, 'omnipotens-final.manifest.json');
  await mkdir(stagesDir, { recursive: true });
  await fsWriteFile(join(stagesDir, 'old.html'), 'old stage', 'utf8');
  await fsWriteFile(finalOutput, 'old final', 'utf8');
  await fsWriteFile(manifestPath, 'old manifest', 'utf8');
  return { reportDir, reportsDir: reportDir, stagesDir, finalOutput, manifestPath };
}

async function assertPreviousGeneration(targets) {
  assert.equal(await readFile(join(targets.stagesDir, 'old.html'), 'utf8'), 'old stage');
  assert.equal(await readFile(targets.finalOutput, 'utf8'), 'old final');
  assert.equal(await readFile(targets.manifestPath, 'utf8'), 'old manifest');
}

function publicationRequest(targets, operations) {
  return {
    ...targets,
    finalContent: 'new final',
    manifestContent: 'new manifest',
    stageReports: [{ filename: '01-new.html', content: 'new stage' }],
    operations,
  };
}

async function transientDirectories(reportDir) {
  return (await readdir(reportDir)).filter((name) => name.startsWith('.omnipotens-report-'));
}

export async function runReportPublicationTests() {
  const root = await mkdtemp(join(tmpdir(), 'omnipotens-publication-'));
  try {
    const writeFaultTargets = await seedPreviousGeneration(join(root, 'write-fault'));
    let writeCount = 0;
    await assert.rejects(
      () => publishReportGeneration(publicationRequest(writeFaultTargets, {
        writeFile: async (...args) => {
          writeCount += 1;
          if (writeCount === 2) throw new Error('injected staging write failure');
          return fsWriteFile(...args);
        },
      })),
      /injected staging write failure/,
    );
    await assertPreviousGeneration(writeFaultTargets);
    assert.deepEqual(await transientDirectories(writeFaultTargets.reportDir), []);

    const rollbackTargets = await seedPreviousGeneration(join(root, 'rollback'));
    let publicationFailed = false;
    await assert.rejects(
      () => publishReportGeneration(publicationRequest(rollbackTargets, {
        rename: async (source, target) => {
          if (!publicationFailed
            && source.includes('.omnipotens-report-staging-')
            && target === rollbackTargets.finalOutput) {
            publicationFailed = true;
            throw new Error('injected publication rename failure');
          }
          return fsRename(source, target);
        },
      })),
      /injected publication rename failure/,
    );
    await assertPreviousGeneration(rollbackTargets);
    assert.deepEqual(await transientDirectories(rollbackTargets.reportDir), []);

    const incompleteTargets = await seedPreviousGeneration(join(root, 'incomplete-rollback'));
    let publishFailureInjected = false;
    await assert.rejects(
      () => publishReportGeneration(publicationRequest(incompleteTargets, {
        rename: async (source, target) => {
          if (!publishFailureInjected
            && source.includes('.omnipotens-report-staging-')
            && target === incompleteTargets.finalOutput) {
            publishFailureInjected = true;
            throw new Error('injected publication failure before final report');
          }
          if (source.includes('.omnipotens-report-backup-') && target === incompleteTargets.finalOutput) {
            throw new Error('injected previous final restore failure');
          }
          return fsRename(source, target);
        },
      })),
      /rollback was incomplete/,
    );
    const incompleteTransient = await transientDirectories(incompleteTargets.reportDir);
    const preservedBackup = incompleteTransient.find((name) => name.startsWith('.omnipotens-report-backup-'));
    assert.ok(preservedBackup, 'an incomplete rollback must preserve its backup directory');
    assert.equal(
      await readFile(join(incompleteTargets.reportDir, preservedBackup, 'final.html'), 'utf8'),
      'old final',
    );
    assert.equal(incompleteTransient.some((name) => name.endsWith('.lock')), false);

    const lockTargets = await seedPreviousGeneration(join(root, 'lock'));
    const lockPath = join(lockTargets.reportDir, '.omnipotens-report.lock');
    await mkdir(lockPath);
    await assert.rejects(
      () => publishReportGeneration(publicationRequest(lockTargets)),
      /stale lock exists/,
    );
    await assertPreviousGeneration(lockTargets);
    assert.ok((await readdir(lockTargets.reportDir)).includes(basename(lockPath)), 'foreign lock must not be removed');

    const successTargets = await seedPreviousGeneration(join(root, 'success'));
    await publishReportGeneration(publicationRequest(successTargets));
    assert.equal(await readFile(successTargets.finalOutput, 'utf8'), 'new final');
    assert.equal(await readFile(successTargets.manifestPath, 'utf8'), 'new manifest');
    assert.equal(await readFile(join(successTargets.stagesDir, '01-new.html'), 'utf8'), 'new stage');
    assert.deepEqual(await transientDirectories(successTargets.reportDir), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
