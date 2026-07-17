namespace Omnipotens.AnalysisPlanner.Tests;

internal sealed class TestRunner
{
    public int Run()
    {
        var tests = new (string Name, Action Execute)[]
        {
            ("Catalog loader reads canonical fields and ignores unknown fields", CatalogLoaderTests.LoadsCatalog),
            ("Planner embeds the production analysis catalog", CatalogLoaderTests.LoadsEmbeddedCatalog),
            ("Preset applies transitive required dependencies", SelectionServiceTests.AppliesPresetDependencies),
            ("Recommended dependencies warn without auto-selection", SelectionServiceTests.WarnsForRecommendation),
            ("Later edits preserve explicit selection versus hard dependencies", SelectionServiceTests.PreservesExplicitSelectionAfterLaterEdit),
            ("Run plan JSON round-trips and validates", RunPlanTests.RoundTripsValidPlan),
            ("Run plan validator rejects unsupported schema", RunPlanTests.RejectsInvalidPlan),
            ("Run plan records every not-requested analysis", RunPlanTests.RejectsIncompleteNotRequestedScope),
        };

        var failures = 0;
        foreach (var test in tests)
        {
            try
            {
                test.Execute();
                Console.WriteLine($"PASS {test.Name}");
            }
            catch (Exception exception)
            {
                failures++;
                Console.Error.WriteLine($"FAIL {test.Name}");
                Console.Error.WriteLine(exception);
            }
        }

        Console.WriteLine($"Executed {tests.Length} tests; failures: {failures}.");
        return failures == 0 ? 0 : 1;
    }
}
