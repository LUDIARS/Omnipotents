using System.Text;

namespace Omnipotens.AnalysisPlanner.Core.Plans;

public sealed class RunPlanWriter
{
    private static readonly UTF8Encoding Utf8WithoutBom = new(false);
    private readonly RunPlanJsonSerializer _serializer = new();
    private readonly RunPlanValidator _validator = new();

    public void Write(string path, AnalysisRunPlan plan)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        ArgumentNullException.ThrowIfNull(plan);

        _validator.ValidateAndThrow(plan);

        var targetPath = Path.GetFullPath(path);
        var targetDirectory = Path.GetDirectoryName(targetPath)
            ?? throw new InvalidOperationException($"Run plan path has no parent directory: {targetPath}");
        if (!Directory.Exists(targetDirectory))
        {
            throw new DirectoryNotFoundException($"Run plan directory does not exist: {targetDirectory}");
        }

        var temporaryPath = Path.Combine(
            targetDirectory,
            $".{Path.GetFileName(targetPath)}.{Guid.NewGuid():N}.tmp");
        try
        {
            File.WriteAllText(temporaryPath, _serializer.Serialize(plan), Utf8WithoutBom);
            File.Move(temporaryPath, targetPath, true);
            _validator.ReadAndValidateFile(targetPath);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }
}
