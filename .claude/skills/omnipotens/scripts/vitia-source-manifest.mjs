#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildVitiaUxSourceManifest } from './lib/vitia-source.mjs';

function usage() {
  return 'Usage: node vitia-source-manifest.mjs --vitia <skill-root> --output <manifest.json> [--revision <id>] [--include-monetization]';
}

function parseArguments(argv) {
  const options = { includeMonetization: false, revision: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--include-monetization') {
      options.includeMonetization = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (['--vitia', '--output', '--revision'].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      const key = argument === '--vitia' ? 'vitiaRoot' : argument.slice(2);
      options[key] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.vitiaRoot || !options.output) {
    throw new Error(usage());
  }

  const manifest = await buildVitiaUxSourceManifest(options);
  const output = resolve(options.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Vitia UX source manifest written: ${output}`);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 2;
});
