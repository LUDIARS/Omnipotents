import { readFile } from 'node:fs/promises';

const REQUIRED_STRING_ARRAYS = [
  'allowedClassifications',
  'excludedDirectoryNames',
  'blockedFileNames',
  'blockedFileNamePrefixes',
  'blockedFileNameSuffixes',
  'textFileExtensions',
  'textFileNames',
];
const SUPPORTED_CLASSIFICATIONS = new Set(['public', 'internal']);
const NON_EMPTY_SECURITY_ARRAYS = [
  'allowedClassifications',
  'blockedFileNames',
  'blockedFileNamePrefixes',
  'blockedFileNameSuffixes',
  'textFileExtensions',
];

function requireStringArray(value, name) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`Input boundary policy '${name}' must be an array of non-empty strings.`);
  }
  return value;
}

function compileContentPatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error("Input boundary policy 'contentPatterns' must be a non-empty array.");
  }

  const ids = new Set();
  return patterns.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Input boundary policy contentPatterns[${index}] must be an object.`);
    }
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
      throw new Error(`Input boundary policy contentPatterns[${index}] has an invalid id.`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Input boundary policy has duplicate content pattern id '${entry.id}'.`);
    }
    ids.add(entry.id);
    if (typeof entry.pattern !== 'string' || entry.pattern.length === 0) {
      throw new Error(`Input boundary policy content pattern '${entry.id}' has no pattern.`);
    }
    const flags = entry.flags ?? '';
    if (typeof flags !== 'string' || !/^[im]*$/.test(flags)) {
      throw new Error(`Input boundary policy content pattern '${entry.id}' has unsupported flags.`);
    }
    try {
      return Object.freeze({ id: entry.id, expression: new RegExp(entry.pattern, flags) });
    } catch (error) {
      throw new Error(`Input boundary policy content pattern '${entry.id}' is invalid: ${error.message}`);
    }
  });
}

export async function loadInputBoundaryPolicy(policyPath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(policyPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to load input boundary policy '${policyPath}': ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.schemaVersion !== 1) {
    throw new Error(`Input boundary policy '${policyPath}' must use schemaVersion 1.`);
  }
  for (const name of REQUIRED_STRING_ARRAYS) {
    requireStringArray(parsed[name], name);
  }
  for (const name of NON_EMPTY_SECURITY_ARRAYS) {
    if (parsed[name].length === 0) {
      throw new Error(`Input boundary policy '${name}' must not be empty.`);
    }
  }
  for (const classification of parsed.allowedClassifications) {
    if (!SUPPORTED_CLASSIFICATIONS.has(classification)) {
      throw new Error(`Input boundary policy allows unsupported classification '${classification}'.`);
    }
  }
  if (!Number.isSafeInteger(parsed.maxTextFileBytes) || parsed.maxTextFileBytes < 1024) {
    throw new Error("Input boundary policy 'maxTextFileBytes' must be an integer of at least 1024.");
  }

  const lower = (entries) => new Set(entries.map((entry) => entry.toLowerCase()));
  return Object.freeze({
    schemaVersion: 1,
    allowedClassifications: new Set(parsed.allowedClassifications),
    excludedDirectoryNames: lower(parsed.excludedDirectoryNames),
    blockedFileNames: lower(parsed.blockedFileNames),
    blockedFileNamePrefixes: parsed.blockedFileNamePrefixes.map((entry) => entry.toLowerCase()),
    blockedFileNameSuffixes: parsed.blockedFileNameSuffixes.map((entry) => entry.toLowerCase()),
    textFileExtensions: lower(parsed.textFileExtensions),
    textFileNames: lower(parsed.textFileNames),
    maxTextFileBytes: parsed.maxTextFileBytes,
    contentPatterns: Object.freeze(compileContentPatterns(parsed.contentPatterns)),
  });
}

export function assertAllowedClassification(policy, classification) {
  if (typeof classification !== 'string' || classification.length === 0) {
    throw new Error('An explicit input classification is required.');
  }
  if (!policy.allowedClassifications.has(classification)) {
    throw new Error(
      `Input classification '${classification}' is not allowed. Allowed classifications: ${[
        ...policy.allowedClassifications,
      ].join(', ')}.`,
    );
  }
}
