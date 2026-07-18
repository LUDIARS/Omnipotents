using System.Text.Json;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

internal sealed class RunPlanJsonSerializer
{
    private static readonly JsonSerializerOptions Options = CreateOptions();

    public string Serialize(AnalysisRunPlan plan) => JsonSerializer.Serialize(plan, Options);

    public AnalysisRunPlan Deserialize(string json)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(json);

        return JsonSerializer.Deserialize<AnalysisRunPlan>(json, Options)
            ?? throw new JsonException("Run plan JSON resolved to null.");
    }

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            AllowTrailingCommas = false,
            PropertyNameCaseInsensitive = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            ReadCommentHandling = JsonCommentHandling.Disallow,
            WriteIndented = true,
        };
        options.Converters.Add(new ProjectClassificationJsonConverter());
        return options;
    }
}
