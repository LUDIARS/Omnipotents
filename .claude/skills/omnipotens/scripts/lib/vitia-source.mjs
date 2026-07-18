import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const CORE_VITIA_UX_FILES = Object.freeze([
  'SKILL.md',
  'references/ethics.md',
  'references/evidence.md',
  'references/ux-onboarding.md',
  'references/game-experience.md',
  'scripts/audit_game_experience.py',
  'scripts/score_vitia.py',
]);

export const MONETIZATION_VITIA_UX_FILES = Object.freeze([
  'references/monetization.md',
]);

const COMPATIBILITY_MARKERS = Object.freeze([
  ['SKILL.md', ['label neutrality', 'counterfactual rename check']],
  ['references/game-experience.md', ['counterfactual rename']],
  ['scripts/audit_game_experience.py', ['LABEL_CONTEXT_KEYS', 'ignored_context_keys']],
]);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readVitiaFile(root, relativePath) {
  try {
    return await readFile(resolve(root, relativePath));
  } catch (error) {
    throw new Error(`Vitia UX source is missing required file: ${relativePath}`, { cause: error });
  }
}

function assertCompatibility(relativePath, content, markers) {
  const text = content.toString('utf8').toLowerCase();
  for (const marker of markers) {
    if (!text.includes(marker.toLowerCase())) {
      throw new Error(`Vitia UX source is incompatible: ${relativePath} lacks marker ${JSON.stringify(marker)}`);
    }
  }
}

export async function buildVitiaUxSourceManifest({
  vitiaRoot,
  includeMonetization = false,
  revision = null,
}) {
  if (typeof vitiaRoot !== 'string' || vitiaRoot.trim() === '') {
    throw new TypeError('vitiaRoot must be an explicit non-empty path');
  }
  if (revision !== null && (typeof revision !== 'string' || revision.trim() === '')) {
    throw new TypeError('revision must be null or a non-empty string');
  }

  const sourceRoot = resolve(vitiaRoot);
  const requiredFiles = [
    ...CORE_VITIA_UX_FILES,
    ...(includeMonetization ? MONETIZATION_VITIA_UX_FILES : []),
  ];
  const contents = new Map();
  const files = [];

  for (const relativePath of requiredFiles) {
    const content = await readVitiaFile(sourceRoot, relativePath);
    contents.set(relativePath, content);
    files.push({ path: relativePath, sha256: sha256(content) });
  }

  for (const [relativePath, markers] of COMPATIBILITY_MARKERS) {
    assertCompatibility(relativePath, contents.get(relativePath), markers);
  }

  return {
    schemaVersion: 1,
    source: 'vitia',
    sourceRoot,
    revision: revision?.trim() ?? null,
    profile: includeMonetization ? 'ux-game-experience-paid' : 'ux-game-experience',
    neutrality: {
      required: true,
      compatibilityMarkersVerified: true,
      counterfactualRenameRequired: true,
    },
    files,
  };
}
