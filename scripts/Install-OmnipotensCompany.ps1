[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$PackageRoot,
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }),
    [switch]$Force,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'OmnipotensCompany.Common.psm1') -Force

$validation = Test-OmnipotensCompanyPackage -PackageRoot $PackageRoot
Write-Host "Validated package version $($validation.Version): $($validation.Skills -join ', ')"
if ($ValidateOnly) {
    return
}

$manifestInfo = Read-OmnipotensCompanyManifest -PackageRoot $PackageRoot
$codexHomeFullPath = [System.IO.Path]::GetFullPath($CodexHome)
if (-not (Test-Path -LiteralPath $codexHomeFullPath -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($codexHomeFullPath, 'Create Codex home directory')) {
        New-Item -ItemType Directory -Path $codexHomeFullPath -Force | Out-Null
    }
}
$codexHomeFullPath = Resolve-CompanyDirectory -Path $codexHomeFullPath -Description 'Codex home'
$skillsDestinationRoot = Join-Path $codexHomeFullPath 'skills'
if (-not (Test-Path -LiteralPath $skillsDestinationRoot -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($skillsDestinationRoot, 'Create skill installation directory')) {
        New-Item -ItemType Directory -Path $skillsDestinationRoot -Force | Out-Null
    }
}
$skillsDestinationRoot = Resolve-CompanyDirectory -Path $skillsDestinationRoot -Description 'Skill installation directory'

$stagingRoot = Join-Path $skillsDestinationRoot (".omnipotens-install-{0}" -f [guid]::NewGuid().ToString('N'))
Assert-CompanyChildPath -Parent $skillsDestinationRoot -Candidate $stagingRoot -Description 'Skill staging directory' | Out-Null
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

try {
    foreach ($skill in @($manifestInfo.Value.skills)) {
        $source = Assert-CompanyChildPath -Parent $manifestInfo.Root -Candidate (Join-Path $manifestInfo.Root $skill.source) -Description "Package skill '$($skill.name)'"
        $staged = Join-Path $stagingRoot $skill.name
        Copy-Item -LiteralPath $source -Destination $staged -Recurse -Force
    }

    $backupRoot = Join-Path $codexHomeFullPath 'omnipotens-company-backups'
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupSession = Join-Path $backupRoot (Get-Date -Format 'yyyyMMddHHmmssfff')
    Assert-CompanyChildPath -Parent $backupRoot -Candidate $backupSession -Description 'Skill backup directory' | Out-Null
    New-Item -ItemType Directory -Path $backupSession -Force | Out-Null

    foreach ($skill in @($manifestInfo.Value.skills)) {
        $destination = Assert-CompanyChildPath -Parent $skillsDestinationRoot -Candidate (Join-Path $skillsDestinationRoot $skill.name) -Description "Skill destination '$($skill.name)'"
        $staged = Assert-CompanyChildPath -Parent $stagingRoot -Candidate (Join-Path $stagingRoot $skill.name) -Description "Staged skill '$($skill.name)'"
        if (Test-Path -LiteralPath $destination) {
            if (-not $Force) {
                throw "Skill already exists: $destination. Review it and rerun with -Force to back it up and replace it."
            }
            $backup = Assert-CompanyChildPath -Parent $backupSession -Candidate (Join-Path $backupSession $skill.name) -Description "Backup skill '$($skill.name)'"
            if ($PSCmdlet.ShouldProcess($destination, "Move existing skill to $backup")) {
                Move-Item -LiteralPath $destination -Destination $backup -ErrorAction Stop
            }
        }
        if ($PSCmdlet.ShouldProcess($destination, 'Install validated company skill')) {
            Move-Item -LiteralPath $staged -Destination $destination -ErrorAction Stop
        }
    }

    $policySource = Assert-CompanyChildPath -Parent $manifestInfo.Root -Candidate (Join-Path $manifestInfo.Root $manifestInfo.Value.policy.source) -Description 'Package policy file'
    $policyDestination = Join-Path $codexHomeFullPath 'omnipotens-company-policy.json'
    if ($PSCmdlet.ShouldProcess($policyDestination, 'Install company policy baseline')) {
        Copy-Item -LiteralPath $policySource -Destination $policyDestination -Force
    }

    $receipt = [ordered]@{
        packageVersion = $manifestInfo.Value.packageVersion
        installedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        packageRoot = $manifestInfo.Root
        skills = @($manifestInfo.Value.skills)
        policyPath = $policyDestination
    }
    $receiptPath = Join-Path $codexHomeFullPath 'omnipotens-company-installation.json'
    if ($PSCmdlet.ShouldProcess($receiptPath, 'Write installation receipt')) {
        $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
    }
}
finally {
    Remove-VerifiedCompanyDirectory -Parent $skillsDestinationRoot -Directory $stagingRoot -Confirm:$false
}

Write-Host "Installed Omnipotens company package $($manifestInfo.Value.packageVersion) into $skillsDestinationRoot"
