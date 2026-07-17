using Omnipotens.AnalysisPlanner.Core.Catalog;
using Omnipotens.AnalysisPlanner.Core.Selection;

namespace Omnipotens.AnalysisPlanner.Tests;

internal static class SelectionServiceTests
{
    public static void AppliesPresetDependencies()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);
        var result = new SelectionService(loaded.Catalog).ApplyPreset("advanced-only");

        TestAssert.SequenceEqual(
            new[] { "base", "middle", "advanced" },
            result.SelectedOptions.Select(option => option.Id),
            "Required dependencies must be selected transitively in catalog order.");
        TestAssert.SequenceEqual(
            new[] { "base", "middle" },
            result.AutoAddedAnalysisIds,
            "Only required dependencies should be reported as auto-added.");
    }

    public static void WarnsForRecommendation()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);
        var service = new SelectionService(loaded.Catalog);

        var withoutRecommendation = service.Resolve(new[] { "advanced" });
        TestAssert.True(
            withoutRecommendation.SelectedOptions.All(option => option.Id != "companion"),
            "Recommended analysis must not be auto-selected.");
        TestAssert.Equal(1, withoutRecommendation.Warnings.Count, "Missing recommendation must warn once.");
        TestAssert.Equal(
            "companion",
            withoutRecommendation.Warnings[0].RelatedAnalysisId,
            "Warning must identify the missing recommendation.");

        var withRecommendation = service.Resolve(new[] { "advanced", "companion" });
        TestAssert.Equal(0, withRecommendation.Warnings.Count, "Selected recommendation must clear warning.");
    }

    public static void PreservesExplicitSelectionAfterLaterEdit()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);
        var service = new SelectionService(loaded.Catalog);
        var explicitSelection = new ExplicitSelectionState(loaded.Catalog.AnalysisOptions);

        explicitSelection.SetRequested("advanced", isRequested: true);
        var initial = service.Resolve(explicitSelection.RequestedAnalysisIds);
        explicitSelection.Replace(initial.RequestedAnalysisIds);

        explicitSelection.SetRequested("companion", isRequested: true);
        var edited = service.Resolve(explicitSelection.RequestedAnalysisIds);

        TestAssert.SequenceEqual(
            new[] { "companion", "advanced" },
            edited.RequestedAnalysisIds,
            "A later user edit must not promote auto-added dependencies to explicit requests.");
        TestAssert.SequenceEqual(
            new[] { "base", "middle" },
            edited.AutoAddedAnalysisIds,
            "Hard dependencies must remain distinguishable after a later edit.");
    }
}
