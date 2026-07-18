using System.Text.Json;
using System.Text.Json.Serialization;
using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

internal sealed class ProjectClassificationJsonConverter : JsonConverter<ProjectClassification>
{
    public override ProjectClassification Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException("classification must be 'public' or 'internal'.");
        }

        return reader.GetString() switch
        {
            "public" => ProjectClassification.Public,
            "internal" => ProjectClassification.Internal,
            var value => throw new JsonException($"Unknown project classification: {value}"),
        };
    }

    public override void Write(
        Utf8JsonWriter writer,
        ProjectClassification value,
        JsonSerializerOptions options)
    {
        writer.WriteStringValue(
            value switch
            {
                ProjectClassification.Public => "public",
                ProjectClassification.Internal => "internal",
                _ => throw new JsonException($"Unknown project classification: {value}"),
            });
    }
}
