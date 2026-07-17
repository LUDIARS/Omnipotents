using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Catalog;

internal static class CatalogValidator
{
    private static readonly HashSet<string> KnownGroups = new(StringComparer.Ordinal)
    {
        "core",
        "service",
    };

    private static readonly HashSet<string> KnownEfforts = new(StringComparer.Ordinal)
    {
        "S",
        "M",
        "L",
        "XL",
    };

    public static void Validate(AnalysisCatalog catalog)
    {
        if (catalog.SchemaVersion != CatalogContract.SchemaVersion)
        {
            throw new CatalogValidationException(
                $"Unsupported catalog schemaVersion {catalog.SchemaVersion}; expected {CatalogContract.SchemaVersion}.");
        }

        if (string.IsNullOrWhiteSpace(catalog.CatalogVersion))
        {
            throw new CatalogValidationException("Catalog catalogVersion must be a non-empty string.");
        }

        if (catalog.AnalysisOptions.Count == 0)
        {
            throw new CatalogValidationException("Catalog must contain at least one analysis option.");
        }

        if (catalog.Presets.Count == 0)
        {
            throw new CatalogValidationException("Catalog must contain at least one preset.");
        }

        var optionsById = CreateUniqueOptionIndex(catalog.AnalysisOptions);
        ValidateOptionReferences(catalog.AnalysisOptions, optionsById);
        ValidateRequiredDependencyCycles(catalog.AnalysisOptions, optionsById);
        ValidatePresets(catalog.Presets, optionsById);
    }

    private static void ValidateRequiredDependencyCycles(
        IReadOnlyList<AnalysisOption> options,
        IReadOnlyDictionary<string, AnalysisOption> optionsById)
    {
        var visited = new HashSet<string>(StringComparer.Ordinal);
        var visiting = new HashSet<string>(StringComparer.Ordinal);

        foreach (var option in options)
        {
            Visit(option.Id);
        }

        void Visit(string analysisId)
        {
            if (visited.Contains(analysisId))
            {
                return;
            }

            if (!visiting.Add(analysisId))
            {
                throw new CatalogValidationException(
                    $"Required analysis dependency cycle includes '{analysisId}'.");
            }

            foreach (var requiredId in optionsById[analysisId].RequiredAnalysisIds)
            {
                Visit(requiredId);
            }

            visiting.Remove(analysisId);
            visited.Add(analysisId);
        }
    }

    private static Dictionary<string, AnalysisOption> CreateUniqueOptionIndex(
        IReadOnlyList<AnalysisOption> options)
    {
        var result = new Dictionary<string, AnalysisOption>(StringComparer.Ordinal);
        foreach (var option in options)
        {
            if (option.Order < 1)
            {
                throw new CatalogValidationException($"Analysis '{option.Id}' must have order >= 1.");
            }

            if (!KnownGroups.Contains(option.Group))
            {
                throw new CatalogValidationException(
                    $"Analysis '{option.Id}' has unsupported group '{option.Group}'.");
            }

            if (!KnownEfforts.Contains(option.Effort))
            {
                throw new CatalogValidationException(
                    $"Analysis '{option.Id}' has unsupported effort '{option.Effort}'.");
            }

            if (!result.TryAdd(option.Id, option))
            {
                throw new CatalogValidationException($"Duplicate analysis id: {option.Id}");
            }
        }

        return result;
    }

    private static void ValidateOptionReferences(
        IReadOnlyList<AnalysisOption> options,
        IReadOnlyDictionary<string, AnalysisOption> optionsById)
    {
        foreach (var option in options)
        {
            ValidateReferences(option.Id, option.RequiredAnalysisIds, "requiredAnalysisIds", optionsById);
            ValidateReferences(option.Id, option.RecommendedAnalysisIds, "recommendedAnalysisIds", optionsById);

            var overlap = option.RequiredAnalysisIds
                .Intersect(option.RecommendedAnalysisIds, StringComparer.Ordinal)
                .ToArray();
            if (overlap.Length > 0)
            {
                throw new CatalogValidationException(
                    $"Analysis '{option.Id}' has required/recommended overlap: {string.Join(", ", overlap)}.");
            }
        }
    }

    private static void ValidateReferences(
        string ownerId,
        IReadOnlyList<string> references,
        string propertyName,
        IReadOnlyDictionary<string, AnalysisOption> optionsById)
    {
        foreach (var reference in references)
        {
            if (StringComparer.Ordinal.Equals(ownerId, reference))
            {
                throw new CatalogValidationException(
                    $"Analysis '{ownerId}' cannot reference itself in {propertyName}.");
            }

            if (!optionsById.ContainsKey(reference))
            {
                throw new CatalogValidationException(
                    $"Analysis '{ownerId}' references unknown analysis '{reference}' in {propertyName}.");
            }
        }
    }

    private static void ValidatePresets(
        IReadOnlyList<AnalysisPreset> presets,
        IReadOnlyDictionary<string, AnalysisOption> optionsById)
    {
        var presetIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var preset in presets)
        {
            if (!presetIds.Add(preset.Id))
            {
                throw new CatalogValidationException($"Duplicate preset id: {preset.Id}");
            }

            if (preset.AnalysisIds.Count == 0)
            {
                throw new CatalogValidationException($"Preset '{preset.Id}' has no analyses.");
            }

            foreach (var analysisId in preset.AnalysisIds)
            {
                if (!optionsById.ContainsKey(analysisId))
                {
                    throw new CatalogValidationException(
                        $"Preset '{preset.Id}' references unknown analysis '{analysisId}'.");
                }
            }
        }
    }
}
