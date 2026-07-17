namespace Omnipotens.AnalysisPlanner.Core.Domain;

public sealed record SelectionResult(
    IReadOnlyList<string> RequestedAnalysisIds,
    IReadOnlyList<AnalysisOption> SelectedOptions,
    IReadOnlyList<string> AutoAddedAnalysisIds,
    IReadOnlyList<SelectionWarning> Warnings);
