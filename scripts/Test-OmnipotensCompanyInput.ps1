[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$WorkspaceRoot,
    [Parameter(Mandatory)]
    [ValidateSet('public', 'internal', 'confidential', 'restricted')]
    [string]$Classification,
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }),
    [string]$PolicyPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'OmnipotensCompany.Common.psm1') -Force

if ([string]::IsNullOrWhiteSpace($PolicyPath)) {
    $PolicyPath = Join-Path $CodexHome 'omnipotens-company-policy.json'
}
$policy = Read-OmnipotensCompanyPolicy -PolicyPath $PolicyPath
$allowedClassifications = @($policy.defaults.allowedInputClassifications | ForEach-Object { $_.ToString() })
if ($allowedClassifications -notcontains $Classification) {
    throw "Classification '$Classification' is not permitted by policy. Allowed: $($allowedClassifications -join ', ')"
}

$resolvedWorkspace = Resolve-CompanyDirectory -Path $WorkspaceRoot -Description 'Workspace root'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$inputGatePath = Join-Path $repositoryRoot '.claude/skills/omnipotens/scripts/omnipotens-input-gate.mjs'
if (-not (Test-Path -LiteralPath $inputGatePath -PathType Leaf)) {
    throw "Omnipotens input gate was not found: $inputGatePath"
}
$nodeCommand = @(Get-Command node -CommandType Application -ErrorAction Stop)[0]
$gateArguments = @(
    $inputGatePath,
    '--workspace', $resolvedWorkspace,
    '--classification', $Classification,
    '--phase', 'source-read'
)
$previousErrorActionPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $gateOutput = @(& $nodeCommand.Source @gateArguments 2>&1)
    $gateExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
}
if ($gateExitCode -ne 0) {
    throw "Omnipotens input gate rejected the workspace:`n$($gateOutput -join [Environment]::NewLine)"
}
try {
    $gateReceipt = ($gateOutput -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
}
catch {
    throw "Omnipotens input gate returned an invalid receipt. $($_.Exception.Message)"
}
if ($gateReceipt.status -ne 'passed' -or $gateReceipt.classification -ne $Classification) {
    throw 'Omnipotens input gate returned an inconsistent receipt.'
}

$blockedFiles = @(Find-BlockedCompanyFiles -Root $WorkspaceRoot -Policy $policy)
if ($blockedFiles.Count -gt 0) {
    $blockedFiles | Format-Table -AutoSize | Out-String | Write-Host
    throw "Workspace contains $($blockedFiles.Count) file(s) blocked by company policy. Remove them from the analysis scope or use a sanitized copy."
}

Write-Host "Input preflight passed for '$Classification' workspace: $resolvedWorkspace"
