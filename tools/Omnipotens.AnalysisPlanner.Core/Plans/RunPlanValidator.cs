using System.Text.Json;
using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed class RunPlanValidator
{
    private readonly RunPlanJsonSerializer _serializer = new();

    public void ValidateAndThrow(AnalysisRunPlan plan)
    {
        ThrowIfInvalid(RunPlanShapeValidator.GetErrors(plan));
    }

    public void ValidateAgainstCatalogAndThrow(AnalysisRunPlan plan, LoadedCatalog loadedCatalog)
    {
        ArgumentNullException.ThrowIfNull(loadedCatalog);

        var errors = RunPlanShapeValidator.GetErrors(plan).ToList();
        if (errors.Count == 0)
        {
            RunPlanCatalogValidator.AddErrors(plan, loadedCatalog, errors);
        }

        ThrowIfInvalid(errors);
    }

    public AnalysisRunPlan ReadAndValidateFile(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);

        AnalysisRunPlan plan;
        try
        {
            plan = _serializer.Deserialize(File.ReadAllText(path));
        }
        catch (Exception exception) when (exception is JsonException or NotSupportedException)
        {
            throw new RunPlanValidationException(new[] { $"Run plan JSON is invalid: {exception.Message}" });
        }

        ValidateAndThrow(plan);
        return plan;
    }

    public IReadOnlyList<string> GetErrors(AnalysisRunPlan? plan) =>
        RunPlanShapeValidator.GetErrors(plan);

    private static void ThrowIfInvalid(IReadOnlyList<string> errors)
    {
        if (errors.Count > 0)
        {
            throw new RunPlanValidationException(errors);
        }
    }
}
