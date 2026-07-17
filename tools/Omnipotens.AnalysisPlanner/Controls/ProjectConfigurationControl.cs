using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Controls;

internal sealed class ProjectConfigurationControl : UserControl
{
    private readonly TextBox _projectRoot = new();
    private readonly ComboBox _classification = new();
    private readonly ComboBox _preset = new();
    private bool _changingPresets;

    public ProjectConfigurationControl()
    {
        Dock = DockStyle.Fill;
        AutoSize = true;
        Padding = new Padding(8);

        var browseButton = new Button
        {
            AutoSize = true,
            Text = "参照...",
        };
        browseButton.Click += (_, _) => BrowseRequested?.Invoke(this, EventArgs.Empty);

        var loadButton = new Button
        {
            AutoSize = true,
            Text = "カタログ再読込",
        };
        loadButton.Click += (_, _) => CatalogLoadRequested?.Invoke(this, EventArgs.Empty);

        _projectRoot.Dock = DockStyle.Fill;
        _projectRoot.AccessibleName = "プロジェクト本体フォルダ";

        _classification.DropDownStyle = ComboBoxStyle.DropDownList;
        _classification.Width = 180;
        _classification.Items.Add("公開情報 (public)");
        _classification.Items.Add("社内限定 (internal)");
        _classification.SelectedIndex = 1;

        _preset.DropDownStyle = ComboBoxStyle.DropDownList;
        _preset.Width = 360;
        _preset.DisplayMember = nameof(AnalysisPreset.TitleJa);
        _preset.SelectedIndexChanged += (_, _) =>
        {
            if (!_changingPresets)
            {
                PresetChanged?.Invoke(this, EventArgs.Empty);
            }
        };

        var layout = new TableLayoutPanel
        {
            AutoSize = true,
            ColumnCount = 4,
            Dock = DockStyle.Fill,
            RowCount = 2,
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        layout.Controls.Add(CreateLabel("プロジェクト本体:"), 0, 0);
        layout.Controls.Add(_projectRoot, 1, 0);
        layout.Controls.Add(browseButton, 2, 0);
        layout.Controls.Add(loadButton, 3, 0);

        var options = new FlowLayoutPanel
        {
            AutoSize = true,
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
        };
        options.Controls.Add(CreateLabel("情報区分:"));
        options.Controls.Add(_classification);
        options.Controls.Add(CreateLabel("プリセット:"));
        options.Controls.Add(_preset);
        layout.Controls.Add(options, 1, 1);
        layout.SetColumnSpan(options, 3);

        Controls.Add(layout);
    }

    public event EventHandler? BrowseRequested;

    public event EventHandler? CatalogLoadRequested;

    public event EventHandler? PresetChanged;

    public string ProjectRoot
    {
        get => _projectRoot.Text.Trim();
        set => _projectRoot.Text = value;
    }

    public ProjectClassification Classification =>
        _classification.SelectedIndex == 0
            ? ProjectClassification.Public
            : ProjectClassification.Internal;

    public string? SelectedPresetId => (_preset.SelectedItem as AnalysisPreset)?.Id;

    public void SetPresets(IEnumerable<AnalysisPreset> presets)
    {
        ArgumentNullException.ThrowIfNull(presets);

        _changingPresets = true;
        try
        {
            _preset.BeginUpdate();
            _preset.Items.Clear();
            foreach (var preset in presets)
            {
                _preset.Items.Add(preset);
            }

            _preset.SelectedIndex = -1;
        }
        finally
        {
            _preset.EndUpdate();
            _changingPresets = false;
        }
    }

    public void ClearPresetSelection()
    {
        _changingPresets = true;
        try
        {
            _preset.SelectedIndex = -1;
        }
        finally
        {
            _changingPresets = false;
        }
    }

    private static Label CreateLabel(string text) =>
        new()
        {
            AutoSize = true,
            Margin = new Padding(3, 7, 3, 3),
            Text = text,
        };
}
