import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { sha256Hex } from './service-analysis-catalog.mjs';

async function pathType(path) {
  try {
    return await lstat(path);
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeJsonAtomically(path, value) {
  if (typeof path !== 'string' || path.trim() !== path || path.length === 0) {
    throw new Error('output path must be a non-empty trimmed string');
  }
  const output = resolve(path);
  const parent = dirname(output);
  await mkdir(parent, { recursive: true });

  const parentInfo = await pathType(parent);
  if (!parentInfo?.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error(`output parent must be a real directory: ${parent}`);
  }
  const outputInfo = await pathType(output);
  if (outputInfo?.isSymbolicLink()) throw new Error(`output must not be a symbolic link: ${output}`);
  if (outputInfo?.isDirectory()) throw new Error(`output must not be a directory: ${output}`);

  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const temporary = resolve(parent, `.${basename(output)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  let renamed = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, output);
    renamed = true;
  } finally {
    if (handle) await handle.close();
    if (!renamed) await rm(temporary, { force: true });
  }
  return { output, outputSha256: sha256Hex(bytes), bytesWritten: bytes.byteLength };
}
