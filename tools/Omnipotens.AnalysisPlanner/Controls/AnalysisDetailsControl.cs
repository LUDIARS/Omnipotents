using System.Text;
using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Controls;

internal sealed class AnalysisDetailsControl : UserControl
{
    private readonly RichTextBox _details = new();

    public AnalysisDetailsControl()
    {
        Dock = DockStyle.Fill;
        Padding = new Padding(8);

        _details.BackColor = SystemColors.Window;
        _details.BorderStyle = BorderStyle.FixedSingle;
        _details.Dock = DockStyle.Fill;
        _details.ReadOnly = true;
        _details.Text = "左の分析項目を選ぶと、説明と必要な根拠を表示します。";

        var title = new Label
        {
            AutoSize = true,
            Dock = DockStyle.Top,
            Padding = new Padding(0, 0, 0, 6),
            Text = "項目の詳細",
        };

        Controls.Add(_details);
        Controls.Add(title);
    }

    public void ShowOption(AnalysisOption? option)
    {
        if (option is null)
        {
            _details.Text = "左の分析項目を選ぶと、説明と必要な根拠を表示します。";
            return;
        }

        var text = new StringBuilder();
        text.AppendLine(option.TitleJa);
        text.AppendLine($"ID: {option.Id}");
        text.AppendLine($"工数目安: {option.Effort}");
        text.AppendLine($"参照ソース数: {option.SourceIds.Count}");
        text.AppendLine($"外部サービス利用: {(option.UsesExternalService ? "あり（実行時に別途承認が必要）" : "なし")}");
        text.AppendLine();
        text.AppendLine("説明");
        text.AppendLine(option.SummaryJa);
        AppendList(text, "適用判断の質問", option.ApplicabilityQuestionsJa);
        AppendList(text, "必要な根拠", option.RequiredEvidenceJa);
        AppendList(text, "想定出力", option.Outputs);
        AppendList(text, "必須分析", option.RequiredAnalysisIds);
        AppendList(text, "推奨分析", option.RecommendedAnalysisIds);
        _details.Text = text.ToString();
    }

    private static void AppendList(
        StringBuilder builder,
        string title,
        IReadOnlyList<string> values)
    {
        builder.AppendLine();
        builder.AppendLine(title);
        if (values.Count == 0)
        {
            builder.AppendLine("- なし");
            return;
        }

        foreach (var value in values)
        {
            builder.AppendLine($"- {value}");
        }
    }
}
