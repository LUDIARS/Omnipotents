using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Catalog;

public sealed class CatalogLoader
{
    private readonly CatalogJsonReader _reader = new();

    public LoadedCatalog LoadEmbedded()
    {
        using var stream = typeof(CatalogLoader).Assembly.GetManifestResourceStream(
            CatalogContract.EmbeddedResourceName);
        if (stream is null)
        {
            throw new FileNotFoundException(
                $"Embedded analysis catalog is missing: {CatalogContract.EmbeddedResourceName}");
        }

        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        var content = buffer.ToArray();
        var catalog = _reader.Read(content, CatalogContract.EmbeddedResourceName);

        return new LoadedCatalog(catalog, CatalogContract.EmbeddedResourceName, Sha256Digest.Compute(content));
    }

    public LoadedCatalog LoadFromProjectRoot(string projectRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(projectRoot);

        string normalizedRoot;
        try
        {
            normalizedRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(projectRoot));
        }
        catch (Exception exception) when (exception is ArgumentException or NotSupportedException or PathTooLongException)
        {
            throw new CatalogValidationException($"Project root is invalid: {projectRoot}", exception);
        }

        if (!Directory.Exists(normalizedRoot))
        {
            throw new DirectoryNotFoundException($"Project root does not exist: {normalizedRoot}");
        }

        var catalogPath = Path.GetFullPath(CatalogContract.GetPath(normalizedRoot));
        if (!File.Exists(catalogPath))
        {
            throw new FileNotFoundException(
                $"Analysis catalog was not found. Expected: {CatalogContract.RelativePath}",
                catalogPath);
        }

        return LoadFromFile(catalogPath);
    }

    public LoadedCatalog LoadFromFile(string catalogPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(catalogPath);

        var normalizedPath = Path.GetFullPath(catalogPath);
        if (!File.Exists(normalizedPath))
        {
            throw new FileNotFoundException("Analysis catalog was not found.", normalizedPath);
        }

        var content = File.ReadAllBytes(normalizedPath);
        var catalog = _reader.Read(content, normalizedPath);

        return new LoadedCatalog(catalog, normalizedPath, Sha256Digest.Compute(content));
    }
}
