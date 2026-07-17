const VALUE_OPTIONS = new Set(['output', 'analysis', 'classification', 'project', 'generated-at']);
const BOOLEAN_OPTIONS = new Set(['require-current', 'verify-only']);
const REPEATABLE_OPTIONS = new Set(['analysis']);

export function parseServiceAnalysisArgs(argv) {
  if (!Array.isArray(argv)) throw new Error('argv must be an array');
  const parsed = {
    analysis: [],
    requireCurrent: false,
    verifyOnly: false,
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (typeof token !== 'string' || !token.startsWith('--') || token === '--' || token.includes('=')) {
      throw new Error(`unexpected argument: ${String(token)}`);
    }
    const name = token.slice(2);
    if (!VALUE_OPTIONS.has(name) && !BOOLEAN_OPTIONS.has(name)) {
      throw new Error(`unknown option: --${name}`);
    }
    if (!REPEATABLE_OPTIONS.has(name) && seen.has(name)) {
      throw new Error(`duplicate option: --${name}`);
    }
    seen.add(name);

    if (BOOLEAN_OPTIONS.has(name)) {
      if (name === 'require-current') parsed.requireCurrent = true;
      else parsed.verifyOnly = true;
      continue;
    }

    const value = argv[index + 1];
    if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
      throw new Error(`missing value for --${name}`);
    }
    index += 1;
    if (name === 'analysis') parsed.analysis.push(value);
    else if (name === 'generated-at') parsed.generatedAt = value;
    else parsed[name] = value;
  }

  if (parsed.analysis.length === 0) throw new Error('--analysis is required at least once');
  if (!parsed.classification) throw new Error('--classification is required');
  if (!parsed.project) throw new Error('--project is required');
  if (parsed.verifyOnly && parsed.output) throw new Error('--output cannot be used with --verify-only');
  if (!parsed.verifyOnly && !parsed.output) throw new Error('--output is required unless --verify-only is used');
  return parsed;
}
