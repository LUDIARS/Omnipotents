using System.Text;
using Omnipotens.AnalysisPlanner.Core.Domain;
using Omnipotens.AnalysisPlanner.Core.Plans;

namespace Omnipotens.AnalysisPlanner;

internal sealed class PromptFormatter
{
    public string Format(AnalysisRunPlan plan)
    {
        ArgumentNullException.ThrowIfNull(plan);

        var text = new StringBuilder();
        text.AppendLine("Omnipotens で、次の実行計画に限定して全方位分析を実行してください。");
        text.AppendLine($"プロジェクト本体: {plan.ProjectRoot}");
        text.AppendLine($"情報区分: {FormatClassification(plan.Classification)}");
        text.AppendLine($"カタログ: {plan.CatalogPath}");
        text.AppendLine($"カタログバージョン: {plan.CatalogVersion}");
        text.AppendLine($"カタログ SHA-256: {plan.CatalogSha256}");
        if (plan.PresetId is not null)
        {
            text.AppendLine($"プリセット: {plan.PresetId}");
        }

        text.AppendLine();
        text.AppendLine("明示選択した分析:");
        foreach (var analysis in plan.Analyses.Where(
                     item => plan.SelectedAnalysisIds.Contains(item.Id, StringComparer.Ordinal)))
        {
            var external = analysis.UsesExternalService ? " / 外部サービス境界あり" : string.Empty;
            text.AppendLine($"- {analysis.Id}: {analysis.TitleJa} [工数 {analysis.Effort}{external}]");
        }

        if (plan.RequiredDependencyIds.Count > 0)
        {
            text.AppendLine();
            text.AppendLine("自動追加された必須分析:");
            foreach (var analysisId in plan.RequiredDependencyIds)
            {
                text.AppendLine($"- {analysisId}");
            }
        }

        if (plan.ExternalServiceAnalysisIds.Count > 0)
        {
            text.AppendLine();
            text.AppendLine("外部サービス境界（実行承認とは別）:");
            foreach (var analysisId in plan.ExternalServiceAnalysisIds)
            {
                text.AppendLine($"- {analysisId}");
            }
        }

        text.AppendLine();
        text.AppendLine("実行条件:");
        text.AppendLine("- 選択されていない分析は not-requested として扱ってください。");
        text.AppendLine("- 必要な根拠が不足している場合は推測で埋めず、missing-evidence または partial と記録してください。");
        text.AppendLine("- N/A をゼロ点に変換せず、適用可能性・根拠強度・リスクを分けてください。");
        text.AppendLine("- 外部サービスを使う項目は、送信前に対象データと送信先について別途承認を得てください。");
        text.AppendLine(FormatDataHandling(plan.Classification));

        if (plan.Warnings.Count > 0)
        {
            text.AppendLine();
            text.AppendLine("推奨項目の未選択警告:");
            foreach (var warning in plan.Warnings)
            {
                text.AppendLine($"- {warning.MessageJa}");
            }
        }

        return text.ToString();
    }

    private static string FormatClassification(ProjectClassification classification) =>
        classification switch
        {
            ProjectClassification.Public => "public（公開可能な情報のみ）",
            ProjectClassification.Internal => "internal（社内限定）",
            _ => throw new ArgumentOutOfRangeException(nameof(classification), classification, null),
        };

    private static string FormatDataHandling(ProjectClassification classification) =>
        classification switch
        {
            ProjectClassification.Public =>
                "- 公開可能と確認済みの情報だけを入力・出力に使用してください。",
            ProjectClassification.Internal =>
                "- 社内限定データを外部へ送信・公開せず、ローカルな成果物として扱ってください。",
            _ => throw new ArgumentOutOfRangeException(nameof(classification), classification, null),
        };
}
