import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function validAnalysisSummary(project = 'Fixture') {
  const section = (id, title) => ({
    id,
    title,
    beginner: `${title}の要点を初学者向けに説明します。`,
    highResolution: `${title}の根拠と判断を詳しく説明します。`,
    missingInformation: [], missingImplementation: [],
  });
  const score = (label, value, marketAdvantage = false, id) => ({
    ...(id ? { id } : {}),
    label, score: value, maxScore: 10, rationale: `${label}の根拠です。`, sourceRefs: ['spec/main.md'],
    marketAdvantage,
    averageImprovement: { decision: value < 7 ? 'improve' : 'hold', proposal: value < 7 ? `${label}を平均水準まで整えます。` : '現状を維持します。', rationale: `スコア ${value} / 10 を基準に判断しました。` },
    missingInformation: [], missingImplementation: [],
  });
  return {
    schemaVersion: 4,
    project,
    overallAssessment: {
      label: '条件付きで有望', score: 7, maxScore: 10,
      beginner: {
        summary: '遊びの核は明確ですが、初見説明に改善余地があります。',
        strengths: ['中心の遊びと実装が一致しています。'],
        priorityIssues: ['初見で結果を予測できる説明が不足しています。'],
      },
      highResolution: {
        summary: 'コアメカニクスと実装は整合する一方、予測可能性の実証が不足しています。',
        strengths: ['仕様と実装の主要責務が一致しています。'],
        priorityIssues: ['解決順序の可視化と実測が不足しています。'],
      },
      confidence: '中', sourceRefs: ['spec/main.md'],
      missingInformation: [], missingImplementation: [],
    },
    executiveSummary: {
      'play-logic': section('play-logic', '遊びのロジック'),
      code: section('code', 'コード内容'),
      ux: section('ux', 'UX'),
      market: section('market', '市場分析'),
    },
    additionalAnalyses: [],
    aiFormatScores: [score('仕様整合性', 7)],
    vitiaScores: [score('差別化', 6), score('訴求力', 9, true)],
    uxEvaluation: {
      publicResponseSimulation: { audienceModel: '一般的な初見プレイヤー', assumptions: ['主要導線を初見で体験する'], limitations: ['実ユーザー調査ではない'] },
      scores: [
        score('体験設計のコアと実装の方向一致', 8, false, 'core-implementation-alignment'),
        score('表現の納得性・パフォーマンス', 6, false, 'expression-conviction-performance'),
      ],
    },
    playStructureScores: [
      score('発想', 8, false, 'idea'),
      score('構造', 7, false, 'structure'),
      score('量産性', 6, false, 'scalability'),
    ],
    ludus: {
      novelty: { score: 7, maxScore: 10, rationale: '組み合わせに新規性があります。', sourceRefs: ['spec/main.md'], averageImprovement: { decision: 'hold', proposal: '現状の発想を検証します。', rationale: '新規性スコアが十分で、追加要素は焦点を弱めるためです。' }, missingInformation: [], missingImplementation: [] },
      recommendedImplementations: [{ title: '選択の予告', dictionaryEntries: ['choice.telegraph'], proposal: '選択結果を事前表示します。', uxConnection: '意思決定の納得感を高めます。', priority: '高', missingInformation: [], missingImplementation: [] }],
    },
  };
}

export async function writeAnalysisSummaryFixture(project, title = 'Fixture') {
  const data = join(project, 'spec', 'data');
  await mkdir(data, { recursive: true });
  await writeFile(join(data, 'omnipotens-summary.json'), JSON.stringify(validAnalysisSummary(title)), 'utf8');
}
