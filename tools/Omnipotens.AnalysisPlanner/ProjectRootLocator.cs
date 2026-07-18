namespace Omnipotens.AnalysisPlanner;

internal sealed class ProjectRootLocator
{
    public string FindInitialRoot()
    {
        var currentDirectory = Path.GetFullPath(Environment.CurrentDirectory);
        if (Directory.Exists(currentDirectory))
        {
            return Path.TrimEndingDirectorySeparator(currentDirectory);
        }

        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(AppContext.BaseDirectory));
    }
}
