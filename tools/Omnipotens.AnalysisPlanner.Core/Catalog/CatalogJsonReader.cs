using System.Text.Json;
using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Catalog;

internal sealed class CatalogJsonReader
{
    public AnalysisCatalog Read(ReadOnlyMemory<byte> content, string sourceName)
    {
        try
        {
            using var document = JsonDocument.Parse(
                content,
                new JsonDocumentOptions
                {
                    AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow,
                    MaxDepth = 64,
                });

            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw new CatalogValidationException("Catalog root must be a JSON object.");
            }

            var schemaVersion = ReadRequiredInt32(document.RootElement, "schemaVersion", "catalog");
            var catalogVersion = ReadRequiredString(document.RootElement, "catalogVersion", "catalog");
            var optionsElement = GetRequiredProperty(document.RootElement, "analysisOptions", "catalog");
            var presetsElement = GetRequiredProperty(document.RootElement, "presets", "catalog");
            EnsureArray(optionsElement, "catalog.analysisOptions");
            EnsureArray(presetsElement, "catalog.presets");

            var options = optionsElement
                .EnumerateArray()
                .Select((element, index) => ReadOption(element, $"catalog.analysisOptions[{index}]"))
                .OrderBy(option => option.Order)
                .ThenBy(option => option.Id, StringComparer.Ordinal)
                .ToArray();

            var presets = presetsElement
                .EnumerateArray()
                .Select((element, index) => ReadPreset(element, $"catalog.presets[{index}]"))
                .ToArray();

            var catalog = new AnalysisCatalog(schemaVersion, catalogVersion, options, presets);
            CatalogValidator.Validate(catalog);
            return catalog;
        }
        catch (JsonException exception)
        {
            throw new CatalogValidationException(
                $"Catalog JSON is invalid ({sourceName}): {exception.Message}",
                exception);
        }
    }

    private static AnalysisOption ReadOption(JsonElement element, string path)
    {
        EnsureObject(element, path);

        return new AnalysisOption(
            ReadRequiredString(element, "id", path),
            ReadRequiredInt32(element, "order", path),
            ReadRequiredString(element, "group", path),
            ReadRequiredString(element, "titleJa", path),
            ReadRequiredString(element, "summaryJa", path),
            ReadRequiredString(element, "effort", path),
            ReadStringArray(element, "requiredAnalysisIds", path),
            ReadStringArray(element, "recommendedAnalysisIds", path),
            ReadStringArray(element, "applicabilityQuestionsJa", path),
            ReadStringArray(element, "requiredEvidenceJa", path),
            ReadStringArray(element, "outputs", path),
            ReadStringArray(element, "sourceIds", path),
            ReadRequiredBoolean(element, "usesExternalService", path));
    }

    private static AnalysisPreset ReadPreset(JsonElement element, string path)
    {
        EnsureObject(element, path);

        return new AnalysisPreset(
            ReadRequiredString(element, "id", path),
            ReadRequiredString(element, "titleJa", path),
            ReadRequiredString(element, "descriptionJa", path),
            ReadStringArray(element, "analysisIds", path));
    }

    private static JsonElement GetRequiredProperty(JsonElement element, string propertyName, string path)
    {
        if (!element.TryGetProperty(propertyName, out var value))
        {
            throw new CatalogValidationException($"{path}.{propertyName} is required.");
        }

        return value;
    }

    private static string ReadRequiredString(JsonElement element, string propertyName, string path)
    {
        var value = GetRequiredProperty(element, propertyName, path);
        if (value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString()))
        {
            throw new CatalogValidationException($"{path}.{propertyName} must be a non-empty string.");
        }

        return value.GetString()!.Trim();
    }

    private static int ReadRequiredInt32(JsonElement element, string propertyName, string path)
    {
        var value = GetRequiredProperty(element, propertyName, path);
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var result))
        {
            throw new CatalogValidationException($"{path}.{propertyName} must be a 32-bit integer.");
        }

        return result;
    }

    private static bool ReadRequiredBoolean(JsonElement element, string propertyName, string path)
    {
        var value = GetRequiredProperty(element, propertyName, path);
        if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            throw new CatalogValidationException($"{path}.{propertyName} must be a boolean.");
        }

        return value.GetBoolean();
    }

    private static IReadOnlyList<string> ReadStringArray(JsonElement element, string propertyName, string path)
    {
        var value = GetRequiredProperty(element, propertyName, path);
        EnsureArray(value, $"{path}.{propertyName}");

        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        foreach (var item in value.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(item.GetString()))
            {
                throw new CatalogValidationException(
                    $"{path}.{propertyName}[{index}] must be a non-empty string.");
            }

            var normalized = item.GetString()!.Trim();
            if (!seen.Add(normalized))
            {
                throw new CatalogValidationException(
                    $"{path}.{propertyName} contains duplicate value '{normalized}'.");
            }

            result.Add(normalized);
            index++;
        }

        return result;
    }

    private static void EnsureObject(JsonElement element, string path)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            throw new CatalogValidationException($"{path} must be a JSON object.");
        }
    }

    private static void EnsureArray(JsonElement element, string path)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            throw new CatalogValidationException($"{path} must be a JSON array.");
        }
    }
}
