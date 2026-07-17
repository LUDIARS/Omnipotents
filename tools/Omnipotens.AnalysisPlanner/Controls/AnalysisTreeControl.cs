using Omnipotens.AnalysisPlanner.Core.Domain;
using Omnipotens.AnalysisPlanner.Core.Selection;

namespace Omnipotens.AnalysisPlanner.Controls;

internal sealed class AnalysisTreeControl : UserControl
{
    private readonly TreeView _tree = new();
    private ExplicitSelectionState? _explicitSelection;
    private bool _changingChecks;

    public AnalysisTreeControl()
    {
        Dock = DockStyle.Fill;
        Padding = new Padding(8);

        _tree.CheckBoxes = true;
        _tree.Dock = DockStyle.Fill;
        _tree.HideSelection = false;
        _tree.AfterCheck += HandleAfterCheck;
        _tree.AfterSelect += (_, eventArgs) =>
            SelectedOptionChanged?.Invoke(eventArgs.Node?.Tag as AnalysisOption);

        var title = new Label
        {
            AutoSize = true,
            Dock = DockStyle.Top,
            Padding = new Padding(0, 0, 0, 6),
            Text = "分析項目（必要な項目だけ選択）",
        };

        Controls.Add(_tree);
        Controls.Add(title);
    }

    public event EventHandler? SelectionChanged;

    public event Action<AnalysisOption?>? SelectedOptionChanged;

    public IReadOnlyList<string> GetRequestedIds() =>
        _explicitSelection?.RequestedAnalysisIds ?? Array.Empty<string>();

    public void LoadOptions(IReadOnlyList<AnalysisOption> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _explicitSelection = new ExplicitSelectionState(options);
        _changingChecks = true;
        _tree.BeginUpdate();
        try
        {
            _tree.Nodes.Clear();
            foreach (var group in options.GroupBy(option => option.Group, StringComparer.Ordinal))
            {
                var groupNode = new TreeNode($"{GetGroupTitle(group.Key)} ({group.Count()})");
                foreach (var option in group)
                {
                    groupNode.Nodes.Add(
                        new TreeNode($"{option.TitleJa}  [{option.Effort}]")
                        {
                            Tag = option,
                            ToolTipText = option.SummaryJa,
                        });
                }

                groupNode.Expand();
                _tree.Nodes.Add(groupNode);
            }
        }
        finally
        {
            _tree.EndUpdate();
            _changingChecks = false;
        }
    }

    public void ApplySelection(
        IEnumerable<string> resolvedAnalysisIds,
        IEnumerable<string> requestedAnalysisIds)
    {
        ArgumentNullException.ThrowIfNull(resolvedAnalysisIds);
        ArgumentNullException.ThrowIfNull(requestedAnalysisIds);

        var explicitSelection = _explicitSelection
            ?? throw new InvalidOperationException("Load analysis options before applying a selection.");
        explicitSelection.Replace(requestedAnalysisIds);

        var selected = resolvedAnalysisIds.ToHashSet(StringComparer.Ordinal);
        _changingChecks = true;
        _tree.BeginUpdate();
        try
        {
            foreach (TreeNode group in _tree.Nodes)
            {
                foreach (TreeNode node in group.Nodes)
                {
                    node.Checked = node.Tag is AnalysisOption option && selected.Contains(option.Id);
                }

                group.Checked = group.Nodes.Count > 0 &&
                    group.Nodes.Cast<TreeNode>().All(node => node.Checked);
            }
        }
        finally
        {
            _tree.EndUpdate();
            _changingChecks = false;
        }
    }

    private void HandleAfterCheck(object? sender, TreeViewEventArgs eventArgs)
    {
        if (_changingChecks)
        {
            return;
        }

        var changedNode = eventArgs.Node;
        if (changedNode is null)
        {
            return;
        }

        _changingChecks = true;
        try
        {
            if (changedNode.Tag is null)
            {
                foreach (TreeNode child in changedNode.Nodes)
                {
                    child.Checked = changedNode.Checked;
                    if (child.Tag is AnalysisOption option)
                    {
                        _explicitSelection?.SetRequested(option.Id, changedNode.Checked);
                    }
                }
            }
            else if (changedNode.Tag is AnalysisOption changedOption)
            {
                _explicitSelection?.SetRequested(changedOption.Id, changedNode.Checked);
                if (changedNode.Parent is { } parent)
                {
                    parent.Checked = parent.Nodes.Count > 0 &&
                        parent.Nodes.Cast<TreeNode>().All(node => node.Checked);
                }
            }
        }
        finally
        {
            _changingChecks = false;
        }

        SelectionChanged?.Invoke(this, EventArgs.Empty);
    }

    private static string GetGroupTitle(string group) =>
        group switch
        {
            "core" => "コア分析",
            "service" => "サービス分析",
            _ => group,
        };
}
