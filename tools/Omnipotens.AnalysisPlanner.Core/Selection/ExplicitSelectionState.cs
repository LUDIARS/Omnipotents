using Omnipotens.AnalysisPlanner.Core.Domain;

namespace Omnipotens.AnalysisPlanner.Core.Selection;

public sealed class ExplicitSelectionState
{
    private readonly IReadOnlyList<string> _orderedAnalysisIds;
    private readonly IReadOnlySet<string> _knownAnalysisIds;
    private readonly HashSet<string> _requestedAnalysisIds = new(StringComparer.Ordinal);

    public ExplicitSelectionState(IEnumerable<AnalysisOption> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _orderedAnalysisIds = options.Select(option => option.Id).ToArray();
        _knownAnalysisIds = _orderedAnalysisIds.ToHashSet(StringComparer.Ordinal);
        if (_orderedAnalysisIds.Count != _knownAnalysisIds.Count)
        {
            throw new SelectionException("Analysis options contain duplicate ids.");
        }
    }

    public IReadOnlyList<string> RequestedAnalysisIds => _orderedAnalysisIds
        .Where(_requestedAnalysisIds.Contains)
        .ToArray();

    public void Replace(IEnumerable<string> requestedAnalysisIds)
    {
        ArgumentNullException.ThrowIfNull(requestedAnalysisIds);

        var replacement = Validate(requestedAnalysisIds);
        _requestedAnalysisIds.Clear();
        _requestedAnalysisIds.UnionWith(replacement);
    }

    public void SetRequested(string analysisId, bool isRequested)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(analysisId);
        if (!_knownAnalysisIds.Contains(analysisId))
        {
            throw new SelectionException($"Unknown analysis id: {analysisId}");
        }

        if (isRequested)
        {
            _requestedAnalysisIds.Add(analysisId);
        }
        else
        {
            _requestedAnalysisIds.Remove(analysisId);
        }
    }

    private HashSet<string> Validate(IEnumerable<string> requestedAnalysisIds)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        foreach (var analysisId in requestedAnalysisIds)
        {
            if (string.IsNullOrWhiteSpace(analysisId) || !_knownAnalysisIds.Contains(analysisId))
            {
                throw new SelectionException($"Unknown analysis id: {analysisId}");
            }

            result.Add(analysisId);
        }

        return result;
    }
}
