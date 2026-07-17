using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed record AnalysisRunPlan(
    int SchemaVersion,
    DateTimeOffset GeneratedAt,
    string CatalogVersion,
    string CatalogSha256,
    string CatalogPath,
    ProjectClassification Classification,
    string ProjectRoot,
    string? PresetId,
    IReadOnlyList<string> SelectedAnalysisIds,
    IReadOnlyList<string> ResolvedAnalysisIds,
    IReadOnlyList<string> RequiredDependencyIds,
    IReadOnlyList<string> OmittedRecommendationIds,
    IReadOnlyList<string> ExternalServiceAnalysisIds,
    IReadOnlyList<string> NotRequestedAnalysisIds,
    IReadOnlyList<RunPlanAnalysis> Analyses,
    IReadOnlyList<RunPlanWarning> Warnings)
{
    public const int CurrentSchemaVersion = 1;
}
