import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export function isPathContained(rootPath, candidatePath) {
  const relation = relative(rootPath, candidatePath);
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation));
}

export async function resolveCanonicalWorkspace(workspacePath) {
  const absolutePath = resolve(workspacePath);
  let metadata;
  try {
    metadata = await lstat(absolutePath);
  } catch (error) {
    throw new Error(`Workspace is unavailable '${absolutePath}': ${error.message}`);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Workspace must be a real directory, not a link: ${absolutePath}`);
  }
  return realpath(absolutePath);
}

export async function resolveContainedRegularFile(workspacePath, candidatePath, label) {
  const absolutePath = resolve(workspacePath, candidatePath);
  let metadata;
  try {
    metadata = await lstat(absolutePath);
  } catch (error) {
    throw new Error(`${label} is unavailable '${absolutePath}': ${error.message}`);
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file, not a link: ${absolutePath}`);
  }
  const canonicalPath = await realpath(absolutePath);
  if (!isPathContained(workspacePath, canonicalPath)) {
    throw new Error(`${label} resolves outside the workspace: ${absolutePath}`);
  }
  return Object.freeze({ path: canonicalPath, metadata });
}
