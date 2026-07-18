using System.Security.Cryptography;

namespace Omnipotens.AnalysisPlanner.Core.Catalog;

internal static class Sha256Digest
{
    public static string Compute(ReadOnlySpan<byte> content) =>
        Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
}
