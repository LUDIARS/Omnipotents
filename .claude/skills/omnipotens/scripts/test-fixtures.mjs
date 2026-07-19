import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function validAnalysisSummary(project = 'Fixture') {
  const section = (id, title) => ({
    id, title, beginner: `${title}の要点です。`, highResolution: `${title}の根拠を含む詳細です。`,
    missingInformation: [], missingImplementation: [],
  });
  const score = (label, value, marketAdvantage = false) => ({
    label, score: value, maxScore: 10, rationale: `${label}の根拠です。`, sourceRefs: ['spec/main.md'],
    marketAdvantage, missingInformation: [], missingImplementation: [],
  });
  return {
    schemaVersion: 1,
    project,
    executiveSummary: {
      'play-logic': section('play-logic', '遊びのロジック'),
      code: section('code', 'コード内容'),
      ux: section('ux', 'UX'),
      market: section('market', '市場分析'),
    },
    additionalAnalyses: [],
    aiFormatScores: [score('仕様整合性', 7)],
    vitiaScores: [score('差別化', 6), score('訴求力', 9, true)],
    ludus: {
      novelty: { score: 7, maxScore: 10, rationale: '組み合わせに新規性があります。', sourceRefs: ['spec/main.md'], missingInformation: [], missingImplementation: [] },
      recommendedImplementations: [{ title: '選択の予告', dictionaryEntries: ['choice.telegraph'], proposal: '選択結果を事前表示します。', uxConnection: '意思決定の納得感を高めます。', priority: '高', missingInformation: [], missingImplementation: [] }],
    },
  };
}

export async function writeAnalysisSummaryFixture(project, title = 'Fixture') {
  const data = join(project, 'spec', 'data');
  await mkdir(data, { recursive: true });
  await writeFile(join(data, 'omnipotens-summary.json'), JSON.stringify(validAnalysisSummary(title)), 'utf8');
}
