[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredPaths = @(
    '.claude/skills/omnipotens/SKILL.md',
    '.claude/skills/omnipotens/agents/openai.yaml',
    '.claude/skills/omnipotens/references/artifact-contract.md',
    '.claude/skills/omnipotens/references/service-analysis.md',
    '.claude/skills/omnipotens/references/service-analysis-catalog.json',
    '.claude/skills/omnipotens/references/vitia-ux-integration.md',
    '.claude/skills/omnipotens/scripts/omnipotens-service-cache.mjs',
    '.claude/skills/omnipotens/scripts/test-service-analysis.mjs',
    '.claude/skills/omnipotens/scripts/lib/analysis-run-plan.mjs',
    '.claude/skills/omnipotens/scripts/lib/atomic-json-file.mjs',
    '.claude/skills/omnipotens/scripts/lib/service-analysis-cache.mjs',
    '.claude/skills/omnipotens/scripts/lib/service-analysis-catalog.mjs',
    '.claude/skills/omnipotens/scripts/lib/service-analysis-cli-options.mjs',
    '.claude/skills/omnipotens/scripts/vitia-source-manifest.mjs',
    '.claude/skills/omnipotens/scripts/lib/vitia-source.mjs',
    'scripts/Publish-OmnipotensPlanner.ps1',
    'tools/Omnipotens.AnalysisPlanner/Omnipotens.AnalysisPlanner.csproj',
    'tools/Omnipotens.AnalysisPlanner.Core/Omnipotens.AnalysisPlanner.Core.csproj',
    'tools/Omnipotens.AnalysisPlanner.Tests/Omnipotens.AnalysisPlanner.Tests.csproj',
    'dependencies/Anatomia/bin/anatomia.mjs',
    'dependencies/Ludus/spec/data/okf/README.md'
)

$root = (Resolve-Path -LiteralPath $RepositoryRoot -ErrorAction Stop).Path
foreach ($relativePath in $requiredPaths) {
    $absolutePath = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        throw "Required Omnipotents artifact is missing: $relativePath. Run Initialize-OmnipotensDependencies.ps1 before retrying."
    }
}

Write-Host "Omnipotents repository verification passed: $root"
