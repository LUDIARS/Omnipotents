import { createHash } from 'node:crypto';
import { lstat, open, opendir, readFile, realpath } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { isPathContained, resolveContainedRegularFile } from './input-path-boundary.mjs';

const TEXT_SAMPLE_BYTES = 8192;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const SHIFT_JIS_DECODER = new TextDecoder('shift_jis', { fatal: true });

function relativeDisplayPath(workspacePath, filePath) {
  return relative(workspacePath, filePath).replaceAll('\\', '/');
}

function assertSafeFileName(policy, workspacePath, filePath) {
  const name = basename(filePath).toLowerCase();
  const isBlocked =
    policy.blockedFileNames.has(name) ||
    policy.blockedFileNamePrefixes.some((prefix) => name.startsWith(prefix)) ||
    policy.blockedFileNameSuffixes.some((suffix) => name.endsWith(suffix));
  if (isBlocked) {
    throw new Error(`Input boundary rejected sensitive filename: ${relativeDisplayPath(workspacePath, filePath)}`);
  }
}

function shouldInspectText(policy, filePath) {
  const name = basename(filePath).toLowerCase();
  return policy.textFileExtensions.has(extname(name)) || policy.textFileNames.has(name);
}

function resemblesBomlessUtf16(bytes) {
  const pairCount = Math.floor(bytes.length / 2);
  if (pairCount < 2) return false;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    if (bytes[index] === 0) evenZeros += 1;
    if (bytes[index + 1] === 0) oddZeros += 1;
  }
  return evenZeros / pairCount >= 0.3 || oddZeros / pairCount >= 0.3;
}

function decodeUtf8(bytes) {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

function isShiftJisLead(byte) {
  return (byte >= 0x81 && byte <= 0x9f) || (byte >= 0xe0 && byte <= 0xfc);
}

function isShiftJisTrail(byte) {
  return (byte >= 0x40 && byte <= 0x7e) || (byte >= 0x80 && byte <= 0xfc);
}

function decodeShiftJis(bytes) {
  let hasJapaneseByte = false;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte <= 0x7f) continue;
    if (byte >= 0xa1 && byte <= 0xdf) {
      hasJapaneseByte = true;
      continue;
    }
    if (!isShiftJisLead(byte) || index + 1 >= bytes.length || !isShiftJisTrail(bytes[index + 1])) {
      return null;
    }
    hasJapaneseByte = true;
    index += 1;
  }
  if (!hasJapaneseByte) return null;
  try {
    return SHIFT_JIS_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

function decodeText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const contentBytes = bytes.length - 2 - ((bytes.length - 2) % 2);
    const littleEndian = Buffer.alloc(contentBytes);
    for (let index = 2; index < contentBytes + 2; index += 2) {
      littleEndian[index - 2] = bytes[index + 1];
      littleEndian[index - 1] = bytes[index];
    }
    return littleEndian.toString('utf16le');
  }
  if (resemblesBomlessUtf16(bytes)) return null;
  return decodeUtf8(bytes) ?? decodeShiftJis(bytes);
}

async function readPrefix(filePath, size) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(size, TEXT_SAMPLE_BYTES));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function inspectRegularFile({ workspacePath, filePath, metadata, policy, result }) {
  assertSafeFileName(policy, workspacePath, filePath);
  result.inspectedFiles += 1;
  const knownTextType = shouldInspectText(policy, filePath);
  if (metadata.size > policy.maxTextFileBytes) {
    if (!knownTextType && decodeText(await readPrefix(filePath, metadata.size)) === null) {
      result.skippedBinaryFiles += 1;
      return;
    }
    throw new Error(
      `Input boundary cannot safely inspect oversized or text-like file (${metadata.size} bytes): ${relativeDisplayPath(
        workspacePath,
        filePath,
      )}`,
    );
  }

  const content = decodeText(await readFile(filePath));
  if (content === null) {
    if (knownTextType) {
      throw new Error(`Input boundary cannot decode known text file: ${relativeDisplayPath(workspacePath, filePath)}`);
    }
    result.skippedBinaryFiles += 1;
    return;
  }
  for (const pattern of policy.contentPatterns) {
    pattern.expression.lastIndex = 0;
    if (pattern.expression.test(content)) {
      throw new Error(
        `Input boundary detected '${pattern.id}' in: ${relativeDisplayPath(workspacePath, filePath)}`,
      );
    }
  }
  result.scannedTextFiles += 1;
}

async function walkDirectory({ workspacePath, directoryPath, policy, result }) {
  const directory = await opendir(directoryPath);
  try {
    for await (const entry of directory) {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Input boundary rejects symbolic links and junctions: ${relativeDisplayPath(workspacePath, entryPath)}`);
      }
      if (entry.isDirectory()) {
        if (policy.excludedDirectoryNames.has(entry.name.toLowerCase())) {
          result.excludedDirectories += 1;
          continue;
        }
        const canonicalDirectory = await realpath(entryPath);
        if (!isPathContained(workspacePath, canonicalDirectory)) {
          throw new Error(`Input directory resolves outside the workspace: ${relativeDisplayPath(workspacePath, entryPath)}`);
        }
        await walkDirectory({ workspacePath, directoryPath: canonicalDirectory, policy, result });
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Input boundary found an unsupported filesystem entry: ${relativeDisplayPath(workspacePath, entryPath)}`);
      }
      const metadata = await lstat(entryPath);
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error(`Input boundary found an unsafe filesystem entry: ${relativeDisplayPath(workspacePath, entryPath)}`);
      }
      const canonicalFile = await realpath(entryPath);
      if (!isPathContained(workspacePath, canonicalFile)) {
        throw new Error(`Input file resolves outside the workspace: ${relativeDisplayPath(workspacePath, entryPath)}`);
      }
      await inspectRegularFile({ workspacePath, filePath: canonicalFile, metadata, policy, result });
    }
  } finally {
    await directory.close().catch((error) => {
      if (error?.code !== 'ERR_DIR_CLOSED') throw error;
    });
  }
}

function newScanResult() {
  return {
    inspectedFiles: 0,
    scannedTextFiles: 0,
    skippedBinaryFiles: 0,
    excludedDirectories: 0,
  };
}

export async function scanWorkspace({ workspacePath, policy }) {
  const result = newScanResult();
  await walkDirectory({ workspacePath, directoryPath: workspacePath, policy, result });
  return Object.freeze(result);
}

export async function scanPayloadFiles({ workspacePath, payloadPaths, policy }) {
  const result = newScanResult();
  const payloads = [];
  for (const payloadPath of payloadPaths) {
    const resolved = await resolveContainedRegularFile(workspacePath, payloadPath, 'Outbound payload');
    const scannedTextFilesBefore = result.scannedTextFiles;
    await inspectRegularFile({
      workspacePath,
      filePath: resolved.path,
      metadata: resolved.metadata,
      policy,
      result,
    });
    if (result.scannedTextFiles === scannedTextFilesBefore) {
      throw new Error(`Outbound payload must be fully inspectable text: ${relativeDisplayPath(workspacePath, resolved.path)}`);
    }
    const payloadBytes = await readFile(resolved.path);
    payloads.push(
      Object.freeze({
        path: relativeDisplayPath(workspacePath, resolved.path),
        bytes: payloadBytes.length,
        sha256: createHash('sha256').update(payloadBytes).digest('hex'),
      }),
    );
  }
  return Object.freeze({
    ...result,
    payloadPaths: Object.freeze(payloads.map((payload) => payload.path)),
    payloads: Object.freeze(payloads),
  });
}
