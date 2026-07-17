using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Selection;

public sealed class SelectionService
{
    private readonly AnalysisCatalog _catalog;
    private readonly IReadOnlyDictionary<string, AnalysisOption> _optionsById;
    private readonly IReadOnlyDictionary<string, AnalysisPreset> _presetsById;

    public SelectionService(AnalysisCatalog catalog)
    {
        ArgumentNullException.ThrowIfNull(catalog);

        _catalog = catalog;
        _optionsById = catalog.AnalysisOptions.ToDictionary(option => option.Id, StringComparer.Ordinal);
        _presetsById = catalog.Presets.ToDictionary(preset => preset.Id, StringComparer.Ordinal);
    }

    public SelectionResult ApplyPreset(string presetId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(presetId);

        if (!_presetsById.TryGetValue(presetId, out var preset))
        {
            throw new SelectionException($"Unknown preset id: {presetId}");
        }

        return Resolve(preset.AnalysisIds);
    }

    public SelectionResult Resolve(IEnumerable<string> requestedAnalysisIds)
    {
        ArgumentNullException.ThrowIfNull(requestedAnalysisIds);

        var requested = new HashSet<string>(StringComparer.Ordinal);
        foreach (var rawId in requestedAnalysisIds)
        {
            if (string.IsNullOrWhiteSpace(rawId))
            {
                throw new SelectionException("Selected analysis id must not be empty.");
            }

            var analysisId = rawId.Trim();
            if (!_optionsById.ContainsKey(analysisId))
            {
                throw new SelectionException($"Unknown analysis id: {analysisId}");
            }

            requested.Add(analysisId);
        }

        var selected = new HashSet<string>(requested, StringComparer.Ordinal);
        var pending = new Queue<string>(requested);
        while (pending.Count > 0)
        {
            var option = _optionsById[pending.Dequeue()];
            foreach (var requiredId in option.RequiredAnalysisIds)
            {
                if (selected.Add(requiredId))
                {
                    pending.Enqueue(requiredId);
                }
            }
        }

        var requestedIds = _catalog.AnalysisOptions
            .Where(option => requested.Contains(option.Id))
            .Select(option => option.Id)
            .ToArray();

        var selectedOptions = _catalog.AnalysisOptions
            .Where(option => selected.Contains(option.Id))
            .ToArray();

        var autoAdded = selectedOptions
            .Where(option => !requested.Contains(option.Id))
            .Select(option => option.Id)
            .ToArray();

        var warnings = BuildRecommendationWarnings(selectedOptions, selected);
        return new SelectionResult(requestedIds, selectedOptions, autoAdded, warnings);
    }

    private IReadOnlyList<SelectionWarning> BuildRecommendationWarnings(
        IReadOnlyList<AnalysisOption> selectedOptions,
        IReadOnlySet<string> selectedIds)
    {
        var warnings = new List<SelectionWarning>();
        foreach (var option in selectedOptions)
        {
            foreach (var recommendedId in option.RecommendedAnalysisIds)
            {
                if (selectedIds.Contains(recommendedId))
                {
                    continue;
                }

                var recommended = _optionsById[recommendedId];
                warnings.Add(
                    new SelectionWarning(
                        "recommended-analysis-not-selected",
                        option.Id,
                        recommendedId,
                        $"「{option.TitleJa}」には「{recommended.TitleJa}」の併用が推奨されています。"));
            }
        }

        return warnings;
    }
}
