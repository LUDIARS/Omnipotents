#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  buildVitiaUxSourceManifest,
  CORE_VITIA_UX_FILES,
  MONETIZATION_VITIA_UX_FILES,
} from './lib/vitia-source.mjs';

const root = await mkdtemp(join(tmpdir(), 'omnipotens-vitia-'));
try {
  const fixtureContent = new Map([
    ['SKILL.md', 'label neutrality\ncounterfactual rename check\n'],
    ['references/game-experience.md', 'counterfactual rename\n'],
    ['scripts/audit_game_experience.py', 'LABEL_CONTEXT_KEYS = set()\nignored_context_keys = []\n'],
  ]);
  const allFiles = [...CORE_VITIA_UX_FILES, ...MONETIZATION_VITIA_UX_FILES];
  for (const relativePath of allFiles) {
    const absolutePath = join(root, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fixtureContent.get(relativePath) ?? `${relativePath}\n`, 'utf8');
  }

  const core = await buildVitiaUxSourceManifest({ vitiaRoot: root, revision: 'fixture-1' });
  assert.equal(core.profile, 'ux-game-experience');
  assert.equal(core.revision, 'fixture-1');
  assert.equal(core.files.length, CORE_VITIA_UX_FILES.length);
  assert.ok(core.files.every((item) => /^[a-f0-9]{64}$/.test(item.sha256)));
  assert.equal(core.neutrality.compatibilityMarkersVerified, true);

  const paid = await buildVitiaUxSourceManifest({ vitiaRoot: root, includeMonetization: true });
  assert.equal(paid.profile, 'ux-game-experience-paid');
  assert.equal(paid.files.length, allFiles.length);

  await unlink(join(root, 'references/evidence.md'));
  await assert.rejects(
    () => buildVitiaUxSourceManifest({ vitiaRoot: root }),
    /missing required file: references\/evidence\.md/,
  );

  await writeFile(join(root, 'references/evidence.md'), 'references/evidence.md\n', 'utf8');
  await writeFile(join(root, 'SKILL.md'), 'counterfactual rename check\n', 'utf8');
  await assert.rejects(
    () => buildVitiaUxSourceManifest({ vitiaRoot: root }),
    /SKILL\.md lacks marker "label neutrality"/,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('omnipotens Vitia source tests: ok');
