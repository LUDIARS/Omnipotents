using System.Text;
using Omnipotens.AnalysisPlanner.Core.Catalog;
using Omnipotens.AnalysisPlanner.Core.Domain;
using Omnipotens.AnalysisPlanner.Core.Plans;
using Omnipotens.AnalysisPlanner.Core.Selection;

namespace Omnipotens.AnalysisPlanner.Tests;

internal static class RunPlanTests
{
    private static readonly DateTimeOffset GeneratedAtUtc =
        new(2026, 7, 17, 9, 0, 0, TimeSpan.Zero);

    public static void RoundTripsValidPlan()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);
        var selection = new SelectionService(loaded.Catalog).ApplyPreset("advanced-only");
        var plan = new RunPlanBuilder().Build(
            loaded,
            project.Root,
            ProjectClassification.Internal,
            "advanced-only",
            selection,
            GeneratedAtUtc);
        var path = Path.Combine(project.Root, "run-plan.json");

        new RunPlanWriter().Write(path, plan);
        var validator = new RunPlanValidator();
        var roundTripped = validator.ReadAndValidateFile(path);
        validator.ValidateAgainstCatalogAndThrow(roundTripped, loaded);

        TestAssert.Equal(ProjectClassification.Internal, roundTripped.Classification, "Classification changed.");
        TestAssert.SequenceEqual(
            new[] { "advanced" },
            roundTripped.SelectedAnalysisIds,
            "Explicit selection changed.");
        TestAssert.SequenceEqual(
            new[] { "base", "middle", "advanced" },
            roundTripped.ResolvedAnalysisIds,
            "Resolved dependency closure changed.");
        TestAssert.SequenceEqual(
            new[] { "base", "middle" },
            roundTripped.RequiredDependencyIds,
            "Required dependencies changed.");
        TestAssert.SequenceEqual(
            new[] { "companion" },
            roundTripped.OmittedRecommendationIds,
            "Omitted recommendations changed.");
        TestAssert.SequenceEqual(
            new[] { "advanced" },
            roundTripped.ExternalServiceAnalysisIds,
            "External-service boundary changed.");
        TestAssert.SequenceEqual(
            new[] { "companion" },
            roundTripped.NotRequestedAnalysisIds,
            "Every unresolved analysis must be recorded as not-requested.");
        TestAssert.Equal(3, roundTripped.Analyses.Count, "Resolved analysis snapshot count changed.");
        TestAssert.Equal(loaded.Sha256, roundTripped.CatalogSha256, "Catalog digest changed.");
        TestAssert.Equal(loaded.Catalog.CatalogVersion, roundTripped.CatalogVersion, "Catalog version changed.");

        var bytes = File.ReadAllBytes(path);
        var hasBom = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
        TestAssert.True(!hasBom, "Run plan must be UTF-8 without BOM.");
        TestAssert.True(
            File.ReadAllText(path, Encoding.UTF8).Contains("\"classification\": \"internal\"", StringComparison.Ordinal),
            "Classification must use the stable lowercase JSON value.");
    }

    public static void RejectsInvalidPlan()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);
        var selection = new SelectionService(loaded.Catalog).ApplyPreset("advanced-only");
        var plan = new RunPlanBuilder().Build(
            loaded,
            project.Root,
            ProjectClassification.Public,
            "advanced-only",
            selection,
            GeneratedAtUtc);
        var path = Path.Combine(project.Root, "invalid-run-plan.json");
        new RunPlanWriter().Write(path, plan);

        var json = File.ReadAllText(path, Encoding.UTF8)
            .Replace("\"schemaVersion\": 1", "\"schemaVersion\": 999", StringComparison.Ordinal);
        File.WriteAllText(path, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        TestAssert.Throws<RunPlanValidationException>(
            () => new RunPlanValidator().ReadAndValidateFile(path),
            "Unsupported schema must fail validation.");
    }

    public static void RejectsIncompleteNotRequestedScope()
    {
        using var project = new TemporaryCatalogProject();
        var loaded = new CatalogLoader().LoadFromProjectRoot(project.Root);
        var selection = new SelectionService(loaded.Catalog).ApplyPreset("advanced-only");
        var plan = new RunPlanBuilder().Build(
            loaded,
            project.Root,
            ProjectClassification.Public,
            "advanced-only",
            selection,
            GeneratedAtUtc) with
        {
            NotRequestedAnalysisIds = Array.Empty<string>(),
        };

        TestAssert.Throws<RunPlanValidationException>(
            () => new RunPlanValidator().ValidateAgainstCatalogAndThrow(plan, loaded),
            "Missing not-requested ids must fail catalog validation.");
    }
}
