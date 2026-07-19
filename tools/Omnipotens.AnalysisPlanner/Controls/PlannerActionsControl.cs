using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Controls;

internal sealed class PlannerActionsControl : UserControl
{
    private readonly Button _saveButton = new();
    private readonly Button _copyButton = new();
    private readonly ListBox _warnings = new();
    private readonly Label _status = new();

    public PlannerActionsControl()
    {
        Dock = DockStyle.Fill;
        AutoSize = true;
        Padding = new Padding(8);

        _warnings.Dock = DockStyle.Fill;
        _warnings.Height = 72;
        _warnings.HorizontalScrollbar = true;

        _saveButton.AutoSize = true;
        _saveButton.Enabled = false;
        _saveButton.Text = "実行計画 JSON を保存";
        _saveButton.Click += (_, _) => SaveRequested?.Invoke(this, EventArgs.Empty);

        _copyButton.AutoSize = true;
        _copyButton.Enabled = false;
        _copyButton.Text = "実行プロンプトをコピー";
        _copyButton.Click += (_, _) => CopyPromptRequested?.Invoke(this, EventArgs.Empty);

        _status.AutoEllipsis = true;
        _status.AutoSize = true;
        _status.Margin = new Padding(12, 8, 3, 3);
        _status.Text = "解析対象フォルダを選択してください。";

        var buttonRow = new FlowLayoutPanel
        {
            AutoSize = true,
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
        };
        buttonRow.Controls.Add(_saveButton);
        buttonRow.Controls.Add(_copyButton);
        buttonRow.Controls.Add(_status);

        var layout = new TableLayoutPanel
        {
            AutoSize = true,
            ColumnCount = 1,
            Dock = DockStyle.Fill,
            RowCount = 3,
        };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 76));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(
            new Label
            {
                AutoSize = true,
                Text = "推奨項目の警告（自動追加はしません）",
            },
            0,
            0);
        layout.Controls.Add(_warnings, 0, 1);
        layout.Controls.Add(buttonRow, 0, 2);
        Controls.Add(layout);
    }

    public event EventHandler? SaveRequested;

    public event EventHandler? CopyPromptRequested;

    public void SetWarnings(IReadOnlyList<SelectionWarning> warnings)
    {
        ArgumentNullException.ThrowIfNull(warnings);

        _warnings.BeginUpdate();
        try
        {
            _warnings.Items.Clear();
            if (warnings.Count == 0)
            {
                _warnings.Items.Add("警告はありません。");
            }
            else
            {
                foreach (var warning in warnings)
                {
                    _warnings.Items.Add(warning.MessageJa);
                }
            }
        }
        finally
        {
            _warnings.EndUpdate();
        }
    }

    public void SetPlanActionsEnabled(bool enabled)
    {
        _saveButton.Enabled = enabled;
        _copyButton.Enabled = enabled;
    }

    public void SetStatus(string status)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(status);
        _status.Text = status;
    }
}
