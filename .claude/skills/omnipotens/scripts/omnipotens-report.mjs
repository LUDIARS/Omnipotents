#!/usr/bin/env node
import { resolve } from 'node:path';
import { generateReport } from './lib/generate-report.mjs';
import { parseReportArgs } from './lib/report-cli-options.mjs';

async function main() {
  const args = parseReportArgs(process.argv.slice(2));
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
