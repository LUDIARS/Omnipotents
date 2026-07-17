namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed record RunPlanWarning(
    string Code,
    string AnalysisId,
    string RelatedAnalysisId,
    string MessageJa);
