import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateReport } from './lib/generate-report.mjs';
import { parseReportArgs } from './lib/report-cli-options.mjs';
import { writeAnalysisSummaryFixture } from './test-fixtures.mjs';

async function writeLayout(project, sections) {
  const data = join(project, 'spec', 'data');
  await mkdir(data, { recursive: true });
  const path = join(data, 'omnipotens-report-layout.json');
  await writeFile(path, JSON.stringify({ sections }), 'utf8');
  return path;
}

async function createDirectoryLink(target, path) {
  try {
    await symlink(target, path, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) return false;
    throw error;
  }
}

export async function runReportHardeningTests() {
  assert.deepEqual(
    parseReportArgs(['--project', 'fixture', '--include', 'a.md', '--include', 'b.md']),
    { project: 'fixture', include: ['a.md', 'b.md'] },
  );
  assert.throws(() => parseReportArgs(['--project', 'fixture', '--unknown', 'x']), /unknown option/);
  assert.throws(() => parseReportArgs(['--project', 'one', '--project', 'two']), /duplicate option/);
  assert.throws(() => parseReportArgs(['--project']), /missing value/);
  assert.throws(() => parseReportArgs(['fixture']), /unexpected argument/);

  const root = await mkdtemp(join(tmpdir(), 'omnipotens-hardening-'));
  try {
    const layoutProject = join(root, 'layout-includes');
    await mkdir(join(layoutProject, 'spec'), { recursive: true });
    await writeFile(join(layoutProject, 'spec', 'main.md'), '# Main\n\nPrimary evidence.', 'utf8');
    await writeAnalysisSummaryFixture(layoutProject);
    await writeFile(join(layoutProject, 'extra.md'), '# Included Markdown\n\nINCLUDE_WITH_LAYOUT', 'utf8');
    await writeFile(join(layoutProject, 'extra.html'), '<!doctype html><title>Included HTML</title>', 'utf8');
    await writeLayout(layoutProject, [{ id: 'Core', title: 'Core evidence', sources: ['spec/main.md'] }]);
    const layoutResult = await generateReport({
      projectRoot: layoutProject,
      includes: [join(layoutProject, 'extra.md'), join(layoutProject, 'extra.html')],
    });
    assert.equal(layoutResult.stages, 2);
    const layoutHtml = await readFile(layoutResult.output, 'utf8');
    assert.match(layoutHtml, /INCLUDE_WITH_LAYOUT/);
    assert.match(layoutHtml, /extra\.html/);
    const relatedStage = await readFile(join(layoutProject, 'report', 'stages', '99-関連レポート.html'), 'utf8');
    assert.match(relatedStage, /INCLUDE_WITH_LAYOUT/);
    assert.match(relatedStage, /extra\.html/);
    const regeneratedLayout = await generateReport({
      projectRoot: layoutProject,
      includes: [join(layoutProject, 'extra.md'), join(layoutProject, 'extra.html')],
    });
    assert.equal(regeneratedLayout.stages, 2, 'an owned prior generation must be replaceable');
    const unownedExistingStage = join(layoutProject, 'report', 'stages', 'unowned.txt');
    await writeFile(unownedExistingStage, 'must survive', 'utf8');
    await assert.rejects(
      () => generateReport({
        projectRoot: layoutProject,
        includes: [join(layoutProject, 'extra.md'), join(layoutProject, 'extra.html')],
      }),
      /do not match their ownership manifest/,
    );
    assert.equal(await readFile(unownedExistingStage, 'utf8'), 'must survive');

    const fallbackProject = join(root, 'fallback-includes');
    await mkdir(join(fallbackProject, 'spec'), { recursive: true });
    await writeFile(join(fallbackProject, 'spec', 'main.md'), '# Fallback\n\nFallback evidence.', 'utf8');
    await writeAnalysisSummaryFixture(fallbackProject);
    await writeFile(join(fallbackProject, 'extra.json'), JSON.stringify({ marker: 'INCLUDE_WITHOUT_LAYOUT' }), 'utf8');
    const fallbackResult = await generateReport({
      projectRoot: fallbackProject,
      includes: [join(fallbackProject, 'extra.json')],
    });
    assert.equal(fallbackResult.stages, 2);
    assert.match(await readFile(fallbackResult.output, 'utf8'), /INCLUDE_WITHOUT_LAYOUT/);

    const explicitProject = join(root, 'explicit-inputs');
    await mkdir(join(explicitProject, 'spec'), { recursive: true });
    await writeFile(join(explicitProject, 'spec', 'main.md'), '# Explicit\n\nEvidence.', 'utf8');
    await writeAnalysisSummaryFixture(explicitProject);
    await assert.rejects(
      () => generateReport({ projectRoot: explicitProject, layoutPath: join(explicitProject, 'missing-layout.json') }),
      /Explicit report layout does not exist/,
    );
    await assert.rejects(
      () => generateReport({ projectRoot: explicitProject, includes: [join(explicitProject, 'missing.md')] }),
      /Explicit report include does not exist/,
    );
    await assert.rejects(
      () => generateReport({ projectRoot: explicitProject, specRoot: join(explicitProject, 'missing-spec') }),
      /Explicit report spec directory does not exist/,
    );
    await assert.rejects(
      () => generateReport({ projectRoot: explicitProject, output: join(explicitProject, 'report', 'not-html.json') }),
      /must use the \.html extension/,
    );

    const unsafeIdProject = join(root, 'unsafe-id');
    await mkdir(join(unsafeIdProject, 'spec'), { recursive: true });
    await writeFile(join(unsafeIdProject, 'spec', 'main.md'), '# Unsafe\n\nEvidence.', 'utf8');
    await writeAnalysisSummaryFixture(unsafeIdProject);
    await writeLayout(unsafeIdProject, [{ id: '../escape', title: 'Escape', sources: ['spec/main.md'] }]);
    await assert.rejects(() => generateReport({ projectRoot: unsafeIdProject }), /Unsafe report section id/);
    await writeLayout(unsafeIdProject, [
      { id: 'Stage', title: 'First', sources: ['spec/main.md'] },
      { id: 'stage', title: 'Second', sources: ['spec/main.md'] },
    ]);
    await assert.rejects(() => generateReport({ projectRoot: unsafeIdProject }), /case-insensitive/);

    const containmentProject = join(root, 'containment');
    await mkdir(join(containmentProject, 'spec'), { recursive: true });
    await writeFile(join(containmentProject, 'spec', 'main.md'), '# Contained\n\nEvidence.', 'utf8');
    await writeAnalysisSummaryFixture(containmentProject);
    const outsideFile = join(root, 'outside.md');
    await writeFile(outsideFile, '# Outside\n\nMust not be read.', 'utf8');
    await assert.rejects(
      () => generateReport({ projectRoot: containmentProject, includes: [outsideFile] }),
      /must be inside the project/,
    );
    await assert.rejects(
      () => generateReport({ projectRoot: containmentProject, output: join(root, 'escaped-output.html') }),
      /must be inside the project/,
    );
    await writeLayout(containmentProject, [{ id: '01', title: 'Escape source', sources: ['../outside.md'] }]);
    await assert.rejects(() => generateReport({ projectRoot: containmentProject }), /must be inside the project/);

    const linkProject = join(root, 'links');
    const externalSource = join(root, 'external-source');
    await mkdir(join(linkProject, 'spec'), { recursive: true });
    await mkdir(externalSource, { recursive: true });
    await writeFile(join(externalSource, 'linked.md'), '# Linked\n\nMust not be read.', 'utf8');
    await writeAnalysisSummaryFixture(linkProject);
    const sourceLink = join(linkProject, 'linked-source');
    const sourceLinkCreated = await createDirectoryLink(externalSource, sourceLink);
    if (process.platform === 'win32') {
      assert.equal(sourceLinkCreated, true, 'Windows junction regression fixture must be available');
    }
    if (sourceLinkCreated) {
      await assert.rejects(
        () => generateReport({ projectRoot: sourceLink }),
        /Project root must not be a symbolic link or junction/,
      );
      await writeLayout(linkProject, [{ id: '01', title: 'Linked source', sources: ['linked-source/linked.md'] }]);
      await assert.rejects(() => generateReport({ projectRoot: linkProject }), /symbolic link or junction/);

      const externalOutput = join(root, 'external-output');
      await mkdir(externalOutput);
      const outputLink = join(linkProject, 'linked-output');
      const outputLinkCreated = await createDirectoryLink(externalOutput, outputLink);
      if (process.platform === 'win32') {
        assert.equal(outputLinkCreated, true, 'Windows output junction regression fixture must be available');
      }
      if (outputLinkCreated) {
        await assert.rejects(
          () => generateReport({ projectRoot: linkProject, output: join(outputLink, 'report.html') }),
          /symbolic link or junction/,
        );
      }
    }

    const overlapProject = join(root, 'overlap');
    await mkdir(join(overlapProject, 'spec'), { recursive: true });
    await writeFile(join(overlapProject, 'spec', 'main.md'), '# Overlap\n\nEvidence.', 'utf8');
    await writeAnalysisSummaryFixture(overlapProject);
    await assert.rejects(
      () => generateReport({
        projectRoot: overlapProject,
        includes: [join(overlapProject, 'report', 'stages', 'old.html')],
      }),
      /must not be inside the generated stages directory/,
    );

    const ownershipProject = join(root, 'ownership');
    await mkdir(join(ownershipProject, 'spec'), { recursive: true });
    await writeFile(join(ownershipProject, 'spec', 'main.md'), '# Ownership\n\nEvidence.', 'utf8');
    await writeAnalysisSummaryFixture(ownershipProject);
    await mkdir(join(ownershipProject, 'stages'));
    const unrelatedStage = join(ownershipProject, 'stages', 'unrelated.txt');
    await writeFile(unrelatedStage, 'must survive', 'utf8');
    await assert.rejects(
      () => generateReport({
        projectRoot: ownershipProject,
        output: join(ownershipProject, 'custom-final.html'),
      }),
      /incomplete or unowned report generation/,
    );
    assert.equal(await readFile(unrelatedStage, 'utf8'), 'must survive');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
