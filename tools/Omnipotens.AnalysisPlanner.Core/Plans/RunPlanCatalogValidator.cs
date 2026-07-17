using Omnipotens.AnalysisPlanner.Core.Domain;
using Omnipotens.AnalysisPlanner.Core.Selection;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

internal static class RunPlanCatalogValidator
{
    public static void AddErrors(
        AnalysisRunPlan plan,
        LoadedCatalog loadedCatalog,
        ICollection<string> errors)
    {
        var catalog = loadedCatalog.Catalog;
        if (!StringComparer.Ordinal.Equals(plan.CatalogVersion, catalog.CatalogVersion))
        {
            errors.Add("Run plan catalogVersion does not match the loaded catalog.");
        }

        if (!StringComparer.Ordinal.Equals(plan.CatalogSha256, loadedCatalog.Sha256))
        {
            errors.Add("Run plan catalogSha256 does not match the loaded catalog.");
        }

        SelectionResult expectedSelection;
        try
        {
            expectedSelection = new SelectionService(catalog).Resolve(plan.SelectedAnalysisIds);
        }
        catch (SelectionException exception)
        {
            errors.Add(exception.Message);
            return;
        }

        CompareSequence(
            expectedSelection.RequestedAnalysisIds,
            plan.SelectedAnalysisIds,
            "selectedAnalysisIds do not match the loaded catalog order.",
            errors);
        CompareSequence(
            expectedSelection.SelectedOptions.Select(option => option.Id),
            plan.ResolvedAnalysisIds,
            "resolvedAnalysisIds do not match the required dependency closure.",
            errors);
        CompareSequence(
            expectedSelection.AutoAddedAnalysisIds,
            plan.RequiredDependencyIds,
            "requiredDependencyIds do not match the required dependency closure.",
            errors);

        var omittedIds = catalog.AnalysisOptions
            .Where(option => expectedSelection.Warnings.Any(
                warning => StringComparer.Ordinal.Equals(warning.RelatedAnalysisId, option.Id)))
            .Select(option => option.Id);
        CompareSequence(
            omittedIds,
            plan.OmittedRecommendationIds,
            "omittedRecommendationIds do not match the loaded catalog.",
            errors);

        var externalIds = expectedSelection.SelectedOptions
            .Where(option => option.UsesExternalService)
            .Select(option => option.Id);
        CompareSequence(
            externalIds,
            plan.ExternalServiceAnalysisIds,
            "externalServiceAnalysisIds do not match the loaded catalog.",
            errors);

        var resolvedIdSet = expectedSelection.SelectedOptions
            .Select(option => option.Id)
            .ToHashSet(StringComparer.Ordinal);
        var notRequestedIds = catalog.AnalysisOptions
            .Where(option => !resolvedIdSet.Contains(option.Id))
            .Select(option => option.Id);
        CompareSequence(
            notRequestedIds,
            plan.NotRequestedAnalysisIds,
            "notRequestedAnalysisIds must enumerate every unresolved catalog analysis.",
            errors);

        ValidatePreset(plan, catalog, errors);
        ValidateSnapshots(plan, catalog, errors);
        ValidateWarnings(plan, expectedSelection, errors);
    }

    private static void ValidatePreset(
        AnalysisRunPlan plan,
        AnalysisCatalog catalog,
        ICollection<string> errors)
    {
        if (plan.PresetId is null)
        {
            return;
        }

        var preset = catalog.Presets.FirstOrDefault(
            item => StringComparer.Ordinal.Equals(item.Id, plan.PresetId));
        if (preset is null)
        {
            errors.Add($"Run plan references unknown preset '{plan.PresetId}'.");
            return;
        }

        var expectedRequestedIds = catalog.AnalysisOptions
            .Where(option => preset.AnalysisIds.Contains(option.Id, StringComparer.Ordinal))
            .Select(option => option.Id);
        CompareSequence(
            expectedRequestedIds,
            plan.SelectedAnalysisIds,
            $"selectedAnalysisIds do not match preset '{preset.Id}'.",
            errors);
    }

    private static void ValidateSnapshots(
        AnalysisRunPlan plan,
        AnalysisCatalog catalog,
        ICollection<string> errors)
    {
        var optionsById = catalog.AnalysisOptions.ToDictionary(option => option.Id, StringComparer.Ordinal);
        foreach (var snapshot in plan.Analyses)
        {
            if (!optionsById.TryGetValue(snapshot.Id, out var option))
            {
                errors.Add($"Run plan references unknown analysis '{snapshot.Id}'.");
                continue;
            }

            if (snapshot.Order != option.Order ||
                !StringComparer.Ordinal.Equals(snapshot.Group, option.Group) ||
                !StringComparer.Ordinal.Equals(snapshot.TitleJa, option.TitleJa) ||
                !StringComparer.Ordinal.Equals(snapshot.SummaryJa, option.SummaryJa) ||
                !StringComparer.Ordinal.Equals(snapshot.Effort, option.Effort) ||
                snapshot.UsesExternalService != option.UsesExternalService ||
                !snapshot.ApplicabilityQuestionsJa.SequenceEqual(option.ApplicabilityQuestionsJa, StringComparer.Ordinal) ||
                !snapshot.RequiredEvidenceJa.SequenceEqual(option.RequiredEvidenceJa, StringComparer.Ordinal) ||
                !snapshot.Outputs.SequenceEqual(option.Outputs, StringComparer.Ordinal) ||
                !snapshot.SourceIds.SequenceEqual(option.SourceIds, StringComparer.Ordinal))
            {
                errors.Add($"Run plan snapshot for '{snapshot.Id}' does not match the loaded catalog.");
            }
        }
    }

    private static void ValidateWarnings(
        AnalysisRunPlan plan,
        SelectionResult expectedSelection,
        ICollection<string> errors)
    {
        var expectedWarnings = expectedSelection.Warnings
            .Select(warning => new RunPlanWarning(
                warning.Code,
                warning.AnalysisId,
                warning.RelatedAnalysisId,
                warning.MessageJa));
        CompareSequence(
            expectedWarnings,
            plan.Warnings,
            "warnings do not match omitted catalog recommendations.",
            errors);
    }

    private static void CompareSequence<T>(
        IEnumerable<T> expected,
        IEnumerable<T> actual,
        string message,
        ICollection<string> errors)
    {
        if (!expected.SequenceEqual(actual))
        {
            errors.Add(message);
        }
    }
}
