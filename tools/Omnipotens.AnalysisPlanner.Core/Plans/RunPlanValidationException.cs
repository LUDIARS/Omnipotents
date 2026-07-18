namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed class RunPlanValidationException : Exception
{
    public RunPlanValidationException(IReadOnlyList<string> errors)
        : base(string.Join(Environment.NewLine, errors))
    {
        Errors = errors;
    }

    public IReadOnlyList<string> Errors { get; }
}
