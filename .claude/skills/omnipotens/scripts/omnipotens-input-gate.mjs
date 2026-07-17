#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertAllowedClassification, loadInputBoundaryPolicy } from './input-boundary/input-policy.mjs';
import { resolveCanonicalWorkspace } from './input-boundary/input-path-boundary.mjs';
import { scanPayloadFiles, scanWorkspace } from './input-boundary/workspace-scanner.mjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY_PATH = resolve(SCRIPT_DIRECTORY, '../references/input-boundary-policy.json');
const VALUE_OPTIONS = new Set([
  '--workspace',
  '--classification',
  '--phase',
  '--payload',
  '--destination',
  '--policy',
]);

export function parseInputGateArgs(argv) {
  const parsed = { payloads: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!VALUE_OPTIONS.has(option)) {
      throw new Error(`Unknown input gate option: ${option}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Input gate option requires a value: ${option}`);
    }
    index += 1;
    if (option === '--payload') {
      parsed.payloads.push(value);
      continue;
    }
    const name = option.slice(2);
    if (parsed[name] !== undefined) {
      throw new Error(`Input gate option may be specified only once: ${option}`);
    }
    parsed[name] = value;
  }
  return parsed;
}

function validatePhaseArguments(args) {
  if (!args.workspace) throw new Error('Input gate requires --workspace.');
  if (!args.classification) throw new Error('Input gate requires an explicit --classification.');
  if (!['source-read', 'external-send'].includes(args.phase)) {
    throw new Error("Input gate --phase must be 'source-read' or 'external-send'.");
  }
  if (args.phase === 'source-read' && (args.payloads.length > 0 || args.destination)) {
    throw new Error('Source-read input gate does not accept --payload or --destination.');
  }
  if (args.phase === 'external-send' && (args.payloads.length === 0 || !args.destination)) {
    throw new Error('External-send input gate requires --payload and --destination.');
  }
}

export async function runInputGate(rawArgs) {
  const args = Array.isArray(rawArgs) ? parseInputGateArgs(rawArgs) : rawArgs;
  if (!args || !Array.isArray(args.payloads)) throw new Error('Input gate arguments are malformed.');
  validatePhaseArguments(args);
  const policyPath = resolve(args.policy ?? DEFAULT_POLICY_PATH);
  const policy = await loadInputBoundaryPolicy(policyPath);
  assertAllowedClassification(policy, args.classification);
  const workspacePath = await resolveCanonicalWorkspace(args.workspace);
  const scan =
    args.phase === 'source-read'
      ? await scanWorkspace({ workspacePath, policy })
      : await scanPayloadFiles({ workspacePath, payloadPaths: args.payloads, policy });

  return Object.freeze({
    schemaVersion: 1,
    status: 'passed',
    phase: args.phase,
    classification: args.classification,
    destination: args.destination ?? null,
    workspace: workspacePath,
    ...scan,
  });
}

async function main() {
  const receipt = await runInputGate(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`Omnipotens input gate failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
