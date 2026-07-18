namespace Omnipotens.AnalysisPlanner.Core.Catalog;

public static class CatalogContract
{
    public const int SchemaVersion = 1;
    public const string RelativePath = ".claude/skills/omnipotens/references/service-analysis-catalog.json";
    public const string EmbeddedResourceName = "Omnipotens.ServiceAnalysisCatalog.json";

    public static string GetPath(string projectRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(projectRoot);

        return Path.Combine(
            projectRoot,
            ".claude",
            "skills",
            "omnipotens",
            "references",
            "service-analysis-catalog.json");
    }
}
