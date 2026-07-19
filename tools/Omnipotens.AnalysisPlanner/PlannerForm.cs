using Omnipotens.AnalysisPlanner.Controls;
using Omnipotens.AnalysisPlanner.Core.Catalog;
using Omnipotens.AnalysisPlanner.Core.Domain;
using Omnipotens.AnalysisPlanner.Core.Plans;
using Omnipotens.AnalysisPlanner.Core.Selection;

namespace Omnipotens.AnalysisPlanner;

internal sealed class PlannerForm : Form
{
    private readonly ProjectConfigurationControl _configuration = new();
    private readonly AnalysisTreeControl _analysisTree = new();
    private readonly AnalysisDetailsControl _details = new();
    private readonly PlannerActionsControl _actions = new();
    private readonly CatalogLoader _catalogLoader = new();
    private readonly RunPlanBuilder _planBuilder = new();
    private readonly RunPlanValidator _planValidator = new();
    private readonly RunPlanWriter _planWriter = new();
    private readonly PromptFormatter _promptFormatter = new();
    private LoadedCatalog? _loadedCatalog;
    private SelectionService? _selectionService;
    private SelectionResult? _selection;
    private string? _currentPresetId;
    private bool _changingSelection;

    public PlannerForm()
    {
        Text = "Omnipotens Analysis Planner";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(980, 680);
        Size = new Size(1240, 840);

        var split = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical,
            SplitterDistance = 520,
        };
        split.Panel1.Controls.Add(_analysisTree);
        split.Panel2.Controls.Add(_details);

        var layout = new TableLayoutPanel
        {
            ColumnCount = 1,
            Dock = DockStyle.Fill,
            RowCount = 3,
        };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(_configuration, 0, 0);
        layout.Controls.Add(split, 0, 1);
        layout.Controls.Add(_actions, 0, 2);
        Controls.Add(layout);

        _configuration.BrowseRequested += HandleBrowseRequested;
        _configuration.CatalogLoadRequested += (_, _) => LoadCatalog(showErrorDialog: true);
        _configuration.PresetChanged += HandlePresetChanged;
        _analysisTree.SelectionChanged += HandleManualSelectionChanged;
        _analysisTree.SelectedOptionChanged += option => _details.ShowOption(option);
        _actions.SaveRequested += HandleSaveRequested;
        _actions.CopyPromptRequested += HandleCopyPromptRequested;

        _configuration.ProjectRoot = string.Empty;
        Shown += (_, _) => LoadCatalog(showErrorDialog: true);
    }

    private void HandleBrowseRequested(object? sender, EventArgs eventArgs)
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "解析対象として使用する既存のプロジェクトフォルダを選択してください。",
            ShowNewFolderButton = false,
            UseDescriptionForTitle = true,
        };
        if (Directory.Exists(_configuration.ProjectRoot))
        {
            dialog.SelectedPath = _configuration.ProjectRoot;
        }

        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            _configuration.ProjectRoot = Path.TrimEndingDirectorySeparator(
                Path.GetFullPath(dialog.SelectedPath));
            _actions.SetStatus($"解析対象フォルダを選択しました: {_configuration.ProjectRoot}");
        }
    }

    private void LoadCatalog(bool showErrorDialog)
    {
        try
        {
            var loaded = _catalogLoader.LoadEmbedded();
            _loadedCatalog = loaded;
            _selectionService = new SelectionService(loaded.Catalog);
            _selection = _selectionService.Resolve(Array.Empty<string>());
            _currentPresetId = null;

            _configuration.SetPresets(loaded.Catalog.Presets);
            _analysisTree.LoadOptions(loaded.Catalog.AnalysisOptions);
            _analysisTree.ApplySelection(Array.Empty<string>(), Array.Empty<string>());
            UpdateSelectionPresentation("カタログを読み込みました。必要な分析を選択してください。");
        }
        catch (Exception exception)
        {
            _loadedCatalog = null;
            _selectionService = null;
            _selection = null;
            _actions.SetPlanActionsEnabled(false);
            _actions.SetStatus($"カタログ読込エラー: {exception.Message}");
            if (showErrorDialog)
            {
                ShowError("カタログを読み込めませんでした。", exception);
            }
        }
    }

    private void HandlePresetChanged(object? sender, EventArgs eventArgs)
    {
        if (_changingSelection || _selectionService is null)
        {
            return;
        }

        var presetId = _configuration.SelectedPresetId;
        if (presetId is null)
        {
            _currentPresetId = null;
            return;
        }

        try
        {
            _changingSelection = true;
            _selection = _selectionService.ApplyPreset(presetId);
            _currentPresetId = presetId;
            _analysisTree.ApplySelection(
                _selection.SelectedOptions.Select(option => option.Id),
                _selection.RequestedAnalysisIds);
            UpdateSelectionPresentation($"プリセット「{presetId}」を適用しました。");
        }
        catch (Exception exception)
        {
            ShowError("プリセットを適用できませんでした。", exception);
        }
        finally
        {
            _changingSelection = false;
        }
    }

    private void HandleManualSelectionChanged(object? sender, EventArgs eventArgs)
    {
        if (_changingSelection || _selectionService is null)
        {
            return;
        }

        try
        {
            _changingSelection = true;
            _currentPresetId = null;
            _configuration.ClearPresetSelection();
            _selection = _selectionService.Resolve(_analysisTree.GetRequestedIds());
            _analysisTree.ApplySelection(
                _selection.SelectedOptions.Select(option => option.Id),
                _selection.RequestedAnalysisIds);

            var status = _selection.AutoAddedAnalysisIds.Count == 0
                ? "選択を更新しました。"
                : $"必須分析を自動追加しました: {string.Join(", ", _selection.AutoAddedAnalysisIds)}";
            UpdateSelectionPresentation(status);
        }
        catch (Exception exception)
        {
            ShowError("分析項目の選択を更新できませんでした。", exception);
        }
        finally
        {
            _changingSelection = false;
        }
    }

    private void HandleSaveRequested(object? sender, EventArgs eventArgs)
    {
        try
        {
            var plan = BuildCurrentPlan();
            var defaultDirectory = Path.Combine(plan.ProjectRoot, "spec", "data");
            Directory.CreateDirectory(defaultDirectory);
            using var dialog = new SaveFileDialog
            {
                AddExtension = true,
                DefaultExt = "json",
                FileName = "omnipotens-run-plan.json",
                Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                InitialDirectory = defaultDirectory,
                OverwritePrompt = true,
                Title = "Omnipotens 実行計画を保存",
            };
            if (dialog.ShowDialog(this) != DialogResult.OK)
            {
                return;
            }

            _planWriter.Write(dialog.FileName, plan);
            _planValidator.ValidateAgainstCatalogAndThrow(
                _planValidator.ReadAndValidateFile(dialog.FileName),
                _loadedCatalog!);
            _actions.SetStatus($"実行計画を保存しました: {dialog.FileName}");
        }
        catch (Exception exception)
        {
            ShowError("実行計画を保存できませんでした。", exception);
        }
    }

    private void HandleCopyPromptRequested(object? sender, EventArgs eventArgs)
    {
        try
        {
            var plan = BuildCurrentPlan();
            Clipboard.SetText(_promptFormatter.Format(plan));
            _actions.SetStatus("実行プロンプトをクリップボードへコピーしました。");
        }
        catch (Exception exception)
        {
            ShowError("実行プロンプトをコピーできませんでした。", exception);
        }
    }

    private AnalysisRunPlan BuildCurrentPlan()
    {
        if (_loadedCatalog is null || _selection is null)
        {
            throw new InvalidOperationException("先にカタログを読み込んでください。");
        }

        if (_selection.SelectedOptions.Count == 0)
        {
            throw new InvalidOperationException("少なくとも一つの分析項目を選択してください。");
        }

        var plan = _planBuilder.Build(
            _loadedCatalog,
            _configuration.ProjectRoot,
            _configuration.Classification,
            _currentPresetId,
            _selection,
            DateTimeOffset.UtcNow);
        _planValidator.ValidateAgainstCatalogAndThrow(plan, _loadedCatalog);
        return plan;
    }

    private void UpdateSelectionPresentation(string status)
    {
        var selection = _selection;
        _actions.SetWarnings(selection?.Warnings ?? Array.Empty<SelectionWarning>());
        _actions.SetPlanActionsEnabled(selection is { SelectedOptions.Count: > 0 });
        _actions.SetStatus(
            selection is null
                ? status
                : $"{status} 選択数: {selection.SelectedOptions.Count}");
    }

    private void ShowError(string title, Exception exception)
    {
        _actions.SetStatus($"{title} {exception.Message}");
        MessageBox.Show(
            this,
            exception.Message,
            title,
            MessageBoxButtons.OK,
            MessageBoxIcon.Error);
    }
}
