using Omnipotens.AnalysisPlanner.Core.Catalog;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

internal static class RunPlanShapeValidator
{
    public static IReadOnlyList<string> GetErrors(AnalysisRunPlan? plan)
    {
        var errors = new List<string>();
        if (plan is null)
        {
            errors.Add("Run plan must not be null.");
            return errors;
        }

        ValidateHeader(plan, errors);

        var selectedIds = ValidateIdList(
            plan.SelectedAnalysisIds,
            "selectedAnalysisIds",
            requireAtLeastOne: true,
            errors);
        var resolvedIds = ValidateIdList(
            plan.ResolvedAnalysisIds,
            "resolvedAnalysisIds",
            requireAtLeastOne: true,
            errors);
        var dependencyIds = ValidateIdList(
            plan.RequiredDependencyIds,
            "requiredDependencyIds",
            requireAtLeastOne: false,
            errors);
        var omittedRecommendationIds = ValidateIdList(
            plan.OmittedRecommendationIds,
            "omittedRecommendationIds",
            requireAtLeastOne: false,
            errors);
        var externalServiceIds = ValidateIdList(
            plan.ExternalServiceAnalysisIds,
            "externalServiceAnalysisIds",
            requireAtLeastOne: false,
            errors);
        var notRequestedIds = ValidateIdList(
            plan.NotRequestedAnalysisIds,
            "notRequestedAnalysisIds",
            requireAtLeastOne: false,
            errors);

        ValidateSelectionPartitions(
            selectedIds,
            resolvedIds,
            dependencyIds,
            omittedRecommendationIds,
            externalServiceIds,
            notRequestedIds,
            errors);
        ValidateAnalyses(plan.Analyses, plan.ResolvedAnalysisIds, errors);
        ValidateWarnings(plan.Warnings, resolvedIds, omittedRecommendationIds, errors);

        return errors;
    }

    private static void ValidateHeader(AnalysisRunPlan plan, ICollection<string> errors)
    {
        if (plan.SchemaVersion != AnalysisRunPlan.CurrentSchemaVersion)
        {
            errors.Add(
                $"Unsupported schemaVersion {plan.SchemaVersion}; expected {AnalysisRunPlan.CurrentSchemaVersion}.");
        }

        if (plan.GeneratedAt == default || plan.GeneratedAt.Offset != TimeSpan.Zero)
        {
            errors.Add("generatedAt must be a non-default UTC timestamp.");
        }

        if (string.IsNullOrWhiteSpace(plan.CatalogVersion) || plan.CatalogVersion.Trim() != plan.CatalogVersion)
        {
            errors.Add("catalogVersion must be a non-empty trimmed string.");
        }

        if (!IsSha256(plan.CatalogSha256))
        {
            errors.Add("catalogSha256 must be 64 lowercase hexadecimal characters.");
        }

        if (!StringComparer.Ordinal.Equals(plan.CatalogPath, CatalogContract.RelativePath))
        {
            errors.Add($"catalogPath must be '{CatalogContract.RelativePath}'.");
        }

        if (!Enum.IsDefined(plan.Classification))
        {
            errors.Add("classification must be public or internal.");
        }

        if (string.IsNullOrWhiteSpace(plan.ProjectRoot) || !Path.IsPathFullyQualified(plan.ProjectRoot))
        {
            errors.Add("projectRoot must be an absolute path.");
        }
    }

    private static HashSet<string> ValidateIdList(
        IReadOnlyList<string>? values,
        string propertyName,
        bool requireAtLeastOne,
        ICollection<string> errors)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        if (values is null)
        {
            errors.Add($"{propertyName} is required.");
            return result;
        }

        if (requireAtLeastOne && values.Count == 0)
        {
            errors.Add($"{propertyName} must contain at least one analysis id.");
        }

        foreach (var analysisId in values)
        {
            if (string.IsNullOrWhiteSpace(analysisId) || analysisId.Trim() != analysisId)
            {
                errors.Add($"{propertyName} must contain non-empty trimmed ids.");
                continue;
            }

            if (!result.Add(analysisId))
            {
                errors.Add($"{propertyName} contains duplicate id '{analysisId}'.");
            }
        }

        return result;
    }

    private static void ValidateSelectionPartitions(
        IReadOnlySet<string> selectedIds,
        IReadOnlySet<string> resolvedIds,
        IReadOnlySet<string> dependencyIds,
        IReadOnlySet<string> omittedRecommendationIds,
        IReadOnlySet<string> externalServiceIds,
        IReadOnlySet<string> notRequestedIds,
        ICollection<string> errors)
    {
        foreach (var selectedId in selectedIds)
        {
            if (!resolvedIds.Contains(selectedId))
            {
                errors.Add($"Selected analysis '{selectedId}' is missing from resolvedAnalysisIds.");
            }
        }

        foreach (var dependencyId in dependencyIds)
        {
            if (!resolvedIds.Contains(dependencyId))
            {
                errors.Add($"Required dependency '{dependencyId}' is missing from resolvedAnalysisIds.");
            }

            if (selectedIds.Contains(dependencyId))
            {
                errors.Add($"Required dependency '{dependencyId}' is also explicitly selected.");
            }
        }

        foreach (var resolvedId in resolvedIds)
        {
            if (!selectedIds.Contains(resolvedId) && !dependencyIds.Contains(resolvedId))
            {
                errors.Add($"Resolved analysis '{resolvedId}' is neither selected nor a required dependency.");
            }

            if (notRequestedIds.Contains(resolvedId))
            {
                errors.Add($"Resolved analysis '{resolvedId}' is also marked not-requested.");
            }
        }

        foreach (var recommendationId in omittedRecommendationIds)
        {
            if (resolvedIds.Contains(recommendationId))
            {
                errors.Add($"Omitted recommendation '{recommendationId}' is resolved.");
            }
        }

        foreach (var externalServiceId in externalServiceIds)
        {
            if (!resolvedIds.Contains(externalServiceId))
            {
                errors.Add($"External-service analysis '{externalServiceId}' is not resolved.");
            }
        }
    }

    private static void ValidateAnalyses(
        IReadOnlyList<RunPlanAnalysis>? analyses,
        IReadOnlyList<string>? resolvedAnalysisIds,
        ICollection<string> errors)
    {
        if (analyses is null)
        {
            errors.Add("analyses is required.");
            return;
        }

        var analysisIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var analysis in analyses)
        {
            if (analysis is null)
            {
                errors.Add("analyses must not contain null items.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(analysis.Id) || !analysisIds.Add(analysis.Id))
            {
                errors.Add("Each analysis snapshot requires a unique, non-empty id.");
            }

            if (analysis.Order < 1 ||
                string.IsNullOrWhiteSpace(analysis.Group) ||
                string.IsNullOrWhiteSpace(analysis.TitleJa) ||
                string.IsNullOrWhiteSpace(analysis.SummaryJa) ||
                string.IsNullOrWhiteSpace(analysis.Effort))
            {
                errors.Add($"Analysis '{analysis.Id}' has incomplete snapshot metadata.");
            }

            ValidateStringList(analysis.ApplicabilityQuestionsJa, $"{analysis.Id}.applicabilityQuestionsJa", errors);
            ValidateStringList(analysis.RequiredEvidenceJa, $"{analysis.Id}.requiredEvidenceJa", errors);
            ValidateStringList(analysis.Outputs, $"{analysis.Id}.outputs", errors);
            ValidateStringList(analysis.SourceIds, $"{analysis.Id}.sourceIds", errors);
        }

        if (resolvedAnalysisIds is not null &&
            !analyses.Select(analysis => analysis?.Id).SequenceEqual(resolvedAnalysisIds, StringComparer.Ordinal))
        {
            errors.Add("analyses snapshots must match resolvedAnalysisIds in the same order.");
        }
    }

    private static void ValidateWarnings(
        IReadOnlyList<RunPlanWarning>? warnings,
        IReadOnlySet<string> resolvedIds,
        IReadOnlySet<string> omittedRecommendationIds,
        ICollection<string> errors)
    {
        if (warnings is null)
        {
            errors.Add("warnings is required.");
            return;
        }

        foreach (var warning in warnings)
        {
            if (warning is null ||
                string.IsNullOrWhiteSpace(warning.Code) ||
                string.IsNullOrWhiteSpace(warning.AnalysisId) ||
                string.IsNullOrWhiteSpace(warning.RelatedAnalysisId) ||
                string.IsNullOrWhiteSpace(warning.MessageJa))
            {
                errors.Add("Each warning requires code, analysisId, relatedAnalysisId and messageJa.");
                continue;
            }

            if (!resolvedIds.Contains(warning.AnalysisId))
            {
                errors.Add($"Warning owner '{warning.AnalysisId}' is not resolved.");
            }

            if (!omittedRecommendationIds.Contains(warning.RelatedAnalysisId))
            {
                errors.Add($"Warning target '{warning.RelatedAnalysisId}' is not an omitted recommendation.");
            }
        }
    }

    private static void ValidateStringList(
        IReadOnlyList<string>? values,
        string path,
        ICollection<string> errors)
    {
        if (values is null)
        {
            errors.Add($"{path} is required.");
            return;
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        if (values.Any(value => string.IsNullOrWhiteSpace(value) || !seen.Add(value)))
        {
            errors.Add($"{path} must contain unique, non-empty strings.");
        }
    }

    private static bool IsSha256(string? value) =>
        value is { Length: 64 } && value.All(character =>
            character is >= '0' and <= '9' or >= 'a' and <= 'f');
}
