[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredPaths = @(
    '.claude/skills/omnipotens/SKILL.md',
    '.claude/skills/omnipotens/references/vitia-ux-integration.md',
    '.claude/skills/omnipotens/scripts/vitia-source-manifest.mjs',
    '.claude/skills/omnipotens/scripts/lib/vitia-source.mjs',
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
