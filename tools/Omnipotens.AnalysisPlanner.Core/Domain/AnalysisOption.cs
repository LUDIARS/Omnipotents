namespace Omnipotens.AnalysisPlanner.Core.Domain;

public sealed record AnalysisOption(
    string Id,
    int Order,
    string Group,
    string TitleJa,
    string SummaryJa,
    string Effort,
    IReadOnlyList<string> RequiredAnalysisIds,
    IReadOnlyList<string> RecommendedAnalysisIds,
    IReadOnlyList<string> ApplicabilityQuestionsJa,
    IReadOnlyList<string> RequiredEvidenceJa,
    IReadOnlyList<string> Outputs,
    IReadOnlyList<string> SourceIds,
    bool UsesExternalService);
