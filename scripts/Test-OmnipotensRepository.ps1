[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredPaths = @(
    'skills/omnipotens/SKILL.md',
    'skills/omnipotens/references/vitia-ux-integration.md',
    'skills/omnipotens/scripts/vitia-source-manifest.mjs',
    'skills/omnipotens/scripts/lib/vitia-source.mjs',
    'config/omnipotens-company-policy.json',
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
