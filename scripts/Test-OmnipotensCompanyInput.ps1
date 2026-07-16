[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$WorkspaceRoot,
    [ValidateSet('public', 'internal', 'confidential', 'restricted')]
    [string]$Classification = 'internal',
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

$blockedFiles = @(Find-BlockedCompanyFiles -Root $WorkspaceRoot -Policy $policy)
if ($blockedFiles.Count -gt 0) {
    $blockedFiles | Format-Table -AutoSize | Out-String | Write-Host
    throw "Workspace contains $($blockedFiles.Count) file(s) blocked by company policy. Remove them from the analysis scope or use a sanitized copy."
}

Write-Host "Input preflight passed for '$Classification' workspace: $(Resolve-CompanyDirectory -Path $WorkspaceRoot -Description 'Workspace root')"
