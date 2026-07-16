#!/usr/bin/env node
import { resolve } from 'node:path';
import { generateReport } from './lib/generate-report.mjs';

function parseArgs(argv) {
  const result = { include: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) throw new Error(`unexpected argument: ${current}`);
    const key = current.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    index += 1;
    if (key === 'include') result.include.push(value);
    else result[key] = value;
  }
  if (!result.project) throw new Error('--project is required');
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const project = resolve(args.project);
  const result = await generateReport({
    projectRoot: project,
    specRoot: args.spec ? resolve(args.spec) : undefined,
    output: args.output ? resolve(args.output) : undefined,
    layoutPath: args.layout ? resolve(args.layout) : undefined,
    title: args.title,
    includes: args.include.map((item) => resolve(item)),
    generatedAt: args['generated-at'] ?? '',
  });
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
