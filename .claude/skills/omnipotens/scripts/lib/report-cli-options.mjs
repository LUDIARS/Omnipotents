const SINGLE_VALUE_OPTIONS = new Set([
  'project',
  'spec',
  'output',
  'layout',
  'title',
  'generated-at',
]);
const REPEATABLE_OPTIONS = new Set(['include']);

function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
    throw new Error(`missing value for --${option}`);
  }
  return value;
}

export function parseReportArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError('Report CLI arguments must be an array.');

  const result = { include: [] };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (typeof current !== 'string' || !current.startsWith('--') || current === '--') {
      throw new Error(`unexpected argument: ${String(current)}`);
    }

    const option = current.slice(2);
    if (!SINGLE_VALUE_OPTIONS.has(option) && !REPEATABLE_OPTIONS.has(option)) {
      throw new Error(`unknown option: --${option}`);
    }

    const value = optionValue(argv, index, option);
    index += 1;
    if (REPEATABLE_OPTIONS.has(option)) {
      result.include.push(value);
      continue;
    }
    if (seen.has(option)) throw new Error(`duplicate option: --${option}`);
    seen.add(option);
    result[option] = value;
  }

  if (!result.project) throw new Error('--project is required');
  return result;
}
