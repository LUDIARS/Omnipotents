namespace Omnipotens.AnalysisPlanner.Core.Domain;

public sealed record AnalysisCatalog(
    int SchemaVersion,
    string CatalogVersion,
    IReadOnlyList<AnalysisOption> AnalysisOptions,
    IReadOnlyList<AnalysisPreset> Presets);
