namespace Omnipotens.AnalysisPlanner.Core.Domain;

public sealed record LoadedCatalog(
    AnalysisCatalog Catalog,
    string SourcePath,
    string Sha256);
