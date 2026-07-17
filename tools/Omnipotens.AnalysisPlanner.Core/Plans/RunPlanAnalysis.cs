namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed record RunPlanAnalysis(
    string Id,
    int Order,
    string Group,
    string TitleJa,
    string SummaryJa,
    string Effort,
    IReadOnlyList<string> ApplicabilityQuestionsJa,
    IReadOnlyList<string> RequiredEvidenceJa,
    IReadOnlyList<string> Outputs,
    IReadOnlyList<string> SourceIds,
    bool UsesExternalService);
