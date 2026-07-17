namespace Omnipotens.AnalysisPlanner.Core.Domain;

public sealed record SelectionWarning(
    string Code,
    string AnalysisId,
    string RelatedAnalysisId,
    string MessageJa);
