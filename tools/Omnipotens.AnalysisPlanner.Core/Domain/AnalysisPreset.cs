namespace Omnipotens.AnalysisPlanner.Core.Domain;

public sealed record AnalysisPreset(
    string Id,
    string TitleJa,
    string DescriptionJa,
    IReadOnlyList<string> AnalysisIds)
{
    public override string ToString() => TitleJa;
}
