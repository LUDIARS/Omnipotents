using Omnipotens.AnalysisPlanner.Core.Catalog;
using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed class RunPlanBuilder
{
    public AnalysisRunPlan Build(
        LoadedCatalog loadedCatalog,
        string projectRoot,
        ProjectClassification classification,
        string? presetId,
        SelectionResult selection,
        DateTimeOffset generatedAtUtc)
    {
        ArgumentNullException.ThrowIfNull(loadedCatalog);
        ArgumentException.ThrowIfNullOrWhiteSpace(projectRoot);
        ArgumentNullException.ThrowIfNull(selection);

        var normalizedRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(projectRoot));
        if (!Directory.Exists(normalizedRoot))
        {
            throw new DirectoryNotFoundException($"Project root does not exist: {normalizedRoot}");
        }

        EnsurePresetExists(loadedCatalog.Catalog, presetId);
        EnsureSelectionBelongsToCatalog(loadedCatalog.Catalog, selection);

        var resolvedAnalysisIds = selection.SelectedOptions
            .Select(option => option.Id)
            .ToArray();
        var resolvedIdSet = resolvedAnalysisIds.ToHashSet(StringComparer.Ordinal);
        var omittedRecommendationIdSet = selection.Warnings
            .Select(warning => warning.RelatedAnalysisId)
            .ToHashSet(StringComparer.Ordinal);
        var omittedRecommendationIds = loadedCatalog.Catalog.AnalysisOptions
            .Where(option => omittedRecommendationIdSet.Contains(option.Id))
            .Select(option => option.Id)
            .ToArray();
        var externalServiceAnalysisIds = selection.SelectedOptions
            .Where(option => option.UsesExternalService)
            .Select(option => option.Id)
            .ToArray();
        var notRequestedAnalysisIds = loadedCatalog.Catalog.AnalysisOptions
            .Where(option => !resolvedIdSet.Contains(option.Id))
            .Select(option => option.Id)
            .ToArray();

        var analyses = selection.SelectedOptions
            .Select(
                option => new RunPlanAnalysis(
                    option.Id,
                    option.Order,
                    option.Group,
                    option.TitleJa,
                    option.SummaryJa,
                    option.Effort,
                    option.ApplicabilityQuestionsJa,
                    option.RequiredEvidenceJa,
                    option.Outputs,
                    option.SourceIds,
                    option.UsesExternalService))
            .ToArray();

        var warnings = selection.Warnings
            .Select(
                warning => new RunPlanWarning(
                    warning.Code,
                    warning.AnalysisId,
                    warning.RelatedAnalysisId,
                    warning.MessageJa))
            .ToArray();

        return new AnalysisRunPlan(
            AnalysisRunPlan.CurrentSchemaVersion,
            generatedAtUtc.ToUniversalTime(),
            loadedCatalog.Catalog.CatalogVersion,
            loadedCatalog.Sha256,
            CatalogContract.RelativePath,
            classification,
            normalizedRoot,
            presetId,
            selection.RequestedAnalysisIds,
            resolvedAnalysisIds,
            selection.AutoAddedAnalysisIds,
            omittedRecommendationIds,
            externalServiceAnalysisIds,
            notRequestedAnalysisIds,
            analyses,
            warnings);
    }

    private static void EnsurePresetExists(AnalysisCatalog catalog, string? presetId)
    {
        if (presetId is null)
        {
            return;
        }

        if (!catalog.Presets.Any(preset => StringComparer.Ordinal.Equals(preset.Id, presetId)))
        {
            throw new InvalidOperationException($"Run plan references unknown preset: {presetId}");
        }
    }

    private static void EnsureSelectionBelongsToCatalog(
        AnalysisCatalog catalog,
        SelectionResult selection)
    {
        var catalogIds = catalog.AnalysisOptions
            .Select(option => option.Id)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var analysisId in selection.RequestedAnalysisIds)
        {
            if (!catalogIds.Contains(analysisId))
            {
                throw new InvalidOperationException(
                    $"Selection contains a request from another catalog: {analysisId}");
            }
        }

        foreach (var option in selection.SelectedOptions)
        {
            if (!catalogIds.Contains(option.Id))
            {
                throw new InvalidOperationException(
                    $"Selection contains an analysis from another catalog: {option.Id}");
            }
        }
    }
}
