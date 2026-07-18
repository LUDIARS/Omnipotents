#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateReport } from './lib/generate-report.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import { runReportHardeningTests } from './test-report-hardening.mjs';
import { runReportPublicationTests } from './test-report-publication.mjs';

assert.match(renderMarkdown('# 見出し\n\n| A | B |\n|---|---|\n| 1 | **強調** |'), /class="table-scroll"/);
assert.doesNotMatch(renderMarkdown('<script>alert(1)</script>'), /<script>/);

const root = await mkdtemp(join(tmpdir(), 'omnipotens-'));
try {
  const spec = join(root, 'spec');
  const data = join(spec, 'data');
  const report = join(root, 'report');
  await Promise.all([mkdir(data, { recursive: true }), mkdir(report, { recursive: true })]);
  await writeFile(join(spec, 'brief.md'), '---\nstatus: complete\n---\n# Product Brief\n\n根拠付きの概要です。', 'utf8');
  await writeFile(join(spec, 'economy.md'), '# Economy\n\n循環は安定しています。', 'utf8');
  await writeFile(join(report, 'architecture-review.html'), '<!doctype html><title>Architecture</title>', 'utf8');
  await writeFile(join(data, 'omnipotens-report-layout.json'), JSON.stringify({ sections: [
    { id: '00', title: '00. エグゼクティブサマリ', sources: ['spec/brief.md'] },
    { id: '04', title: '04. メカニクス解析', sources: ['spec/economy.md'], artifacts: ['report/architecture-review.html'] },
  ] }), 'utf8');

  const result = await generateReport({ projectRoot: root, generatedAt: '2026-07-16', title: 'Fixture' });
  assert.equal(result.stages, 2);
  assert.equal(result.output, join(root, 'report', 'omnipotens-final.html'));
  const html = await readFile(result.output, 'utf8');
  assert.match(html, /OMNIPOTENS/);
  assert.match(html, /--gold:#9a6b1f/);
  assert.match(html, /エグゼクティブサマリ/);
  assert.match(html, /メカニクス解析/);
  assert.match(html, /architecture-review\.html/);
  assert.match(html, /querySelector\('button\[data-theme\]'\)/);
  assert.doesNotMatch(html, /querySelector\('\[data-theme\]'\)/);
  assert.doesNotMatch(html, /#070a12/);
  const stage = await readFile(join(report, 'stages', '00-エグゼクティブサマリ.html'), 'utf8');
  assert.match(stage, /Stage 00/);
  const manifest = JSON.parse(await readFile(result.manifest, 'utf8'));
  assert.ok(manifest.files.length >= 4);
  assert.ok(manifest.files.every((item) => /^[a-f0-9]{64}$/.test(item.sha256)));

  const fallbackRoot = join(root, 'fallback');
  await mkdir(join(fallbackRoot, 'spec'), { recursive: true });
  await writeFile(join(fallbackRoot, 'spec', 'only.md'), '# Only\n\n利用可能な資料です。', 'utf8');
  const fallback = await generateReport({ projectRoot: fallbackRoot });
  assert.equal(fallback.stages, 1);
  const emptyRoot = join(root, 'empty');
  await mkdir(emptyRoot);
  await assert.rejects(() => generateReport({ projectRoot: emptyRoot }), /No Omnipotens artifacts/);
} finally {
  await rm(root, { recursive: true, force: true });
}
await runReportHardeningTests();
await runReportPublicationTests();
console.log('omnipotens report tests: ok');
