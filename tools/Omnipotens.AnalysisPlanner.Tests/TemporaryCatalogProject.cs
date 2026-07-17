using System.Text;
using Omnipotens.AnalysisPlanner.Core.Catalog;

namespace Omnipotens.AnalysisPlanner.Tests;

internal sealed class TemporaryCatalogProject : IDisposable
{
    private static readonly UTF8Encoding Utf8WithoutBom = new(false);
    private bool _disposed;

    public TemporaryCatalogProject()
    {
        Root = Path.Combine(Path.GetTempPath(), $"omnipotens-planner-tests-{Guid.NewGuid():N}");
        var catalogPath = CatalogContract.GetPath(Root);
        Directory.CreateDirectory(Path.GetDirectoryName(catalogPath)!);
        File.WriteAllText(catalogPath, CatalogJson, Utf8WithoutBom);
    }

    public string Root { get; }

    public string CatalogPath => CatalogContract.GetPath(Root);

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        if (Directory.Exists(Root))
        {
            Directory.Delete(Root, recursive: true);
        }
    }

    private const string CatalogJson = """
        {
          "schemaVersion": 1,
          "catalogVersion": "test.2026.07.17",
          "ignoredRootField": { "anything": true },
          "analysisOptions": [
            {
              "id": "base",
              "order": 10,
              "group": "core",
              "titleJa": "基礎分析",
              "summaryJa": "基礎を確認します。",
              "effort": "S",
              "requiredAnalysisIds": [],
              "recommendedAnalysisIds": [],
              "applicabilityQuestionsJa": ["基礎資料がありますか。"],
              "requiredEvidenceJa": ["基礎資料"],
              "outputs": ["base.md"],
              "sourceIds": ["source-a"],
              "usesExternalService": false,
              "ignoredOptionField": "ignored"
            },
            {
              "id": "companion",
              "order": 20,
              "group": "service",
              "titleJa": "推奨分析",
              "summaryJa": "推奨される補助分析です。",
              "effort": "M",
              "requiredAnalysisIds": [],
              "recommendedAnalysisIds": [],
              "applicabilityQuestionsJa": [],
              "requiredEvidenceJa": ["補助資料"],
              "outputs": ["companion.md"],
              "sourceIds": [],
              "usesExternalService": false
            },
            {
              "id": "middle",
              "order": 25,
              "group": "core",
              "titleJa": "中間分析",
              "summaryJa": "必須依存の中間です。",
              "effort": "M",
              "requiredAnalysisIds": ["base"],
              "recommendedAnalysisIds": [],
              "applicabilityQuestionsJa": [],
              "requiredEvidenceJa": ["中間資料"],
              "outputs": ["middle.md"],
              "sourceIds": [],
              "usesExternalService": false
            },
            {
              "id": "advanced",
              "order": 30,
              "group": "service",
              "titleJa": "高度分析",
              "summaryJa": "依存関係を持つ分析です。",
              "effort": "L",
              "requiredAnalysisIds": ["middle"],
              "recommendedAnalysisIds": ["companion"],
              "applicabilityQuestionsJa": ["高度分析が必要ですか。"],
              "requiredEvidenceJa": ["高度資料"],
              "outputs": ["advanced.md"],
              "sourceIds": ["source-a", "source-b"],
              "usesExternalService": true
            }
          ],
          "presets": [
            {
              "id": "advanced-only",
              "titleJa": "高度分析プリセット",
              "descriptionJa": "高度分析と必須依存を選びます。",
              "analysisIds": ["advanced"]
            }
          ]
        }
        """;
}
