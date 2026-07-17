namespace Omnipotens.AnalysisPlanner.Core.Selection;

public sealed class SelectionException : Exception
{
    public SelectionException(string message)
        : base(message)
    {
    }
}
