namespace Omnipotens.AnalysisPlanner.Core.Catalog;

public sealed class CatalogValidationException : Exception
{
    public CatalogValidationException(string message)
        : base(message)
    {
    }

    public CatalogValidationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
