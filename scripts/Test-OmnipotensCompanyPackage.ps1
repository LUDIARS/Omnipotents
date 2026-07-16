[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$PackageRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'OmnipotensCompany.Common.psm1') -Force

$result = Test-OmnipotensCompanyPackage -PackageRoot $PackageRoot
Write-Host "Package version: $($result.Version)"
$result.Skills | ForEach-Object { Write-Host "Verified $_" }
Write-Host "Verified policy: $($result.PolicyDigest)"
