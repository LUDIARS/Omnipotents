[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$SourceSkillsRoot,
    [Parameter(Mandatory)]
    [string[]]$SkillNames,
    [Parameter(Mandatory)]
    [string]$OutputRoot,
    [string]$PolicySource = (Join-Path $PSScriptRoot '../config/omnipotens-company-policy.json'),
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'OmnipotensCompany.Common.psm1') -Force

$sourceRoot = Resolve-CompanyDirectory -Path $SourceSkillsRoot -Description 'Source skills root'
if (-not (Test-Path -LiteralPath $PolicySource -PathType Leaf)) {
    throw "Policy source was not found: $PolicySource"
}
$policy = Read-OmnipotensCompanyPolicy -PolicyPath $PolicySource

$outputFullPath = [System.IO.Path]::GetFullPath($OutputRoot)
$outputParent = Split-Path -Parent $outputFullPath
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
    throw "Output parent directory does not exist: $outputParent"
}
$outputName = Split-Path -Leaf $outputFullPath
if ([string]::IsNullOrWhiteSpace($outputName)) {
    throw 'OutputRoot must name a package directory.'
}

$selectedNames = @($SkillNames | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($selectedNames.Count -eq 0) {
    throw 'At least one skill name is required.'
}
foreach ($skillName in $selectedNames) {
    if (-not (Test-CompanySkillName -Name $skillName)) {
        throw "Unsafe skill name: $skillName"
    }
    $sourceSkill = Assert-CompanyChildPath -Parent $sourceRoot -Candidate (Join-Path $sourceRoot $skillName) -Description "Source skill '$skillName'"
    if (-not (Test-Path -LiteralPath (Join-Path $sourceSkill 'SKILL.md') -PathType Leaf)) {
        throw "Source skill '$skillName' has no SKILL.md."
    }
    $blockedFiles = @(Find-BlockedCompanyFiles -Root $sourceSkill -Policy $policy)
    if ($blockedFiles.Count -gt 0) {
        $paths = $blockedFiles.Path -join ', '
        throw "Source skill '$skillName' contains files blocked by company policy: $paths"
    }
}

if (Test-Path -LiteralPath $outputFullPath) {
    if (-not $Force) {
        throw "Output package already exists: $outputFullPath. Use -Force only after reviewing it."
    }
    $backupRoot = Join-Path $outputParent '.omnipotens-package-backups'
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupPath = Join-Path $backupRoot ("{0}-{1:yyyyMMddHHmmssfff}" -f $outputName, (Get-Date))
    Assert-CompanyChildPath -Parent $backupRoot -Candidate $backupPath -Description 'Package backup' | Out-Null
    if ($PSCmdlet.ShouldProcess($outputFullPath, "Move existing package to $backupPath")) {
        Move-Item -LiteralPath $outputFullPath -Destination $backupPath -ErrorAction Stop
    }
}

$stagingRoot = Join-Path $outputParent (".{0}.staging-{1}" -f $outputName, [guid]::NewGuid().ToString('N'))
Assert-CompanyChildPath -Parent $outputParent -Candidate $stagingRoot -Description 'Package staging directory' | Out-Null
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

try {
    $skillsRoot = Join-Path $stagingRoot 'skills'
    $manifestRoot = Join-Path $stagingRoot 'manifest'
    $configRoot = Join-Path $stagingRoot 'config'
    New-Item -ItemType Directory -Path $skillsRoot, $manifestRoot, $configRoot -Force | Out-Null

    $artifacts = foreach ($skillName in $selectedNames | Sort-Object -Unique) {
        $sourceSkill = Join-Path $sourceRoot $skillName
        $destinationSkill = Join-Path $skillsRoot $skillName
        Copy-Item -LiteralPath $sourceSkill -Destination $destinationSkill -Recurse -Force
        [PSCustomObject]@{
            name = $skillName
            source = "skills/$skillName"
            sha256 = Get-CompanyDirectoryDigest -Directory $destinationSkill
        }
    }

    $policyDestination = Join-Path $configRoot 'omnipotens-company-policy.json'
    Copy-Item -LiteralPath $PolicySource -Destination $policyDestination -Force
    $manifest = [ordered]@{
        schemaVersion = 1
        packageName = 'omnipotens-company'
        packageVersion = (Get-Date -Format 'yyyy.MM.dd.HHmmss')
        createdAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        skills = @($artifacts)
        policy = [ordered]@{
            source = 'config/omnipotens-company-policy.json'
            sha256 = (Get-FileHash -LiteralPath $policyDestination -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    $manifestPath = Join-Path $manifestRoot 'omnipotens-package.manifest.json'
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    Test-OmnipotensCompanyPackage -PackageRoot $stagingRoot | Out-Null
    if ($PSCmdlet.ShouldProcess($outputFullPath, 'Publish validated Omnipotens company package')) {
        Move-Item -LiteralPath $stagingRoot -Destination $outputFullPath -ErrorAction Stop
    }
}
catch {
    Remove-VerifiedCompanyDirectory -Parent $outputParent -Directory $stagingRoot -Confirm:$false
    throw
}

Write-Host "Package created: $outputFullPath"
