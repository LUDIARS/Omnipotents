import { access } from 'node:fs/promises';
import { resolve, extname, basename, relative } from 'node:path';

export const STAGES = [
  { id: '01', title: '仕様ベースライン', files: [['spec', '00-source-manifest.md'], ['spec', '01-product-brief.md'], ['spec', '02-game-spec.md']] },
  { id: '02', title: 'Ludus 遊び解析', files: [['spec', '03-ludus-analysis.md'], ['reports', 'ludus-analysis.html']] },
  { id: '03', title: 'ゲームドメインモデル', files: [['spec', '04-domain-model.md']] },
  { id: '04', title: 'Anatomia コード解析', files: [['spec', '05-anatomia-analysis.md'], ['reports', 'architecture-review.html']] },
  { id: '05', title: '仕様・ドメイン・コード配線', files: [['spec', '06-spec-domain-code-map.md'], ['spec', '07-spec-gaps.md']] },
  { id: '06', title: 'メカニクス・内部経済', files: [['spec', '08-mechanics-economy.md']] },
  { id: '07', title: 'AI Format・構造レビュー', files: [['spec', '09-aiformat-architecture-review.md'], ['reports', 'aiformat-review.html']] },
  { id: '08', title: 'UX 確認・改善提案', files: [['spec', '10-ux-review.md'], ['reports', 'ux-review.html']] },
  { id: '09', title: 'Vitia 市場性分析', files: [['spec', '11-vitia-marketability.md'], ['reports', 'vitia-marketability.html']] },
  { id: '10', title: 'Di ディスカッションペーパー', files: [['spec', '12-di-discussion-paper.md'], ['reports', 'di-discussion-paper.html']] },
];

const kinds = new Map([['.md', 'markdown'], ['.html', 'html'], ['.json', 'json']]);

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function artifact(stage, path, projectRoot, explicit = false) {
  return {
    stageId: stage.id,
    stageTitle: stage.title,
    path,
    relativePath: relative(projectRoot, path).replace(/\\/g, '/'),
    name: basename(path),
    kind: kinds.get(extname(path).toLowerCase()) ?? 'unknown',
    explicit,
  };
}

export async function discoverArtifacts({ projectRoot, specRoot, reportsRoot, includes = [] }) {
  const project = resolve(projectRoot);
  const roots = { spec: resolve(specRoot), reports: resolve(reportsRoot) };
  const found = [];
  for (const stage of STAGES) {
    for (const [scope, file] of stage.files) {
      const preferred = resolve(roots[scope], file);
      if (await exists(preferred)) {
        found.push(artifact(stage, preferred, project));
        continue;
      }
      // Read the former spec/reports layout for migration compatibility, but
      // never write new output there.
      if (scope === 'reports') {
        const legacy = resolve(roots.spec, 'reports', file);
        if (await exists(legacy)) found.push(artifact(stage, legacy, project));
      }
    }
  }
  const rawManifest = resolve(roots.spec, 'raw', 'tool-manifest.json');
  if (await exists(rawManifest)) {
    found.push(artifact({ id: '00', title: 'ツール・出典マニフェスト' }, rawManifest, project));
  }
  for (const include of includes) {
    const path = resolve(include);
    if (!await exists(path)) continue;
    const duplicate = found.some((item) => item.path.toLowerCase() === path.toLowerCase());
    if (!duplicate) found.push(artifact({ id: '99', title: '追加資料' }, path, project, true));
  }
  return found.filter((item) => item.kind !== 'unknown');
}

export function groupByStage(artifacts) {
  const groups = new Map();
  for (const item of artifacts) {
    const group = groups.get(item.stageId) ?? { id: item.stageId, title: item.stageTitle, artifacts: [] };
    group.artifacts.push(item);
    groups.set(item.stageId, group);
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}
