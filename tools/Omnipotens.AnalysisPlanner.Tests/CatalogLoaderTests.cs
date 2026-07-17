using Omnipotens.AnalysisPlanner.Core.Catalog;

namespace Omnipotens.AnalysisPlanner.Tests;

internal static class CatalogLoaderTests
{
    public static void LoadsCatalog()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);

        TestAssert.Equal(4, loaded.Catalog.AnalysisOptions.Count, "Unexpected analysis option count.");
        TestAssert.Equal(1, loaded.Catalog.Presets.Count, "Unexpected preset count.");
        TestAssert.Equal("test.2026.07.17", loaded.Catalog.CatalogVersion, "Catalog version was not loaded.");
        TestAssert.Equal("base", loaded.Catalog.AnalysisOptions[0].Id, "Options must be sorted by order.");
        TestAssert.Equal(
            2,
            loaded.Catalog.AnalysisOptions.Single(option => option.Id == "advanced").SourceIds.Count,
            "sourceIds must be loaded.");
        TestAssert.Equal(64, loaded.Sha256.Length, "Catalog SHA-256 must have 64 characters.");
        TestAssert.Equal(
            Path.GetFullPath(project.CatalogPath),
            loaded.SourcePath,
            "Catalog source path must be canonical.");
    }

    public static void LoadsEmbeddedCatalog()
    {
        var loaded = new CatalogLoader().LoadEmbedded();

        TestAssert.Equal(CatalogContract.SchemaVersion, loaded.Catalog.SchemaVersion, "Embedded schema is invalid.");
        TestAssert.Equal(25, loaded.Catalog.AnalysisOptions.Count, "Embedded catalog analysis count changed.");
        TestAssert.Equal(8, loaded.Catalog.Presets.Count, "Embedded catalog preset count changed.");
        TestAssert.SequenceEqual(
            new[]
            {
                "service.regional-ratings",
                "service.console-certification",
                "service.sbom",
                "service.vendor-risk",
                "service.child-safety",
                "service.generative-ai-governance",
            },
            loaded.Catalog.AnalysisOptions
                .Where(option => option.Order >= 290)
                .Select(option => option.Id),
            "Embedded catalog is missing the added service analyses.");
        TestAssert.Equal(
            CatalogContract.EmbeddedResourceName,
            loaded.SourcePath,
            "Embedded catalog source name changed.");
    }
}
