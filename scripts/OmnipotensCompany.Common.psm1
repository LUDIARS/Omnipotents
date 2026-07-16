Set-StrictMode -Version Latest

function Resolve-CompanyDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Description does not exist or is not a directory: $Path"
    }

    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Assert-CompanyChildPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Parent,
        [Parameter(Mandatory)]
        [string]$Candidate,
        [Parameter(Mandatory)]
        [string]$Description
    )

    $resolvedParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $resolvedCandidate = [System.IO.Path]::GetFullPath($Candidate)
    $prefix = "$resolvedParent$([System.IO.Path]::DirectorySeparatorChar)"

    if (-not $resolvedCandidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Description must stay below $resolvedParent. Received: $resolvedCandidate"
    }

    return $resolvedCandidate
}

function Test-CompanySkillName {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    return $Name -match '^[A-Za-z0-9][A-Za-z0-9._-]*$'
}

function Get-CompanyDirectoryDigest {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Directory)

    $resolvedDirectory = Resolve-CompanyDirectory -Path $Directory -Description 'Digest directory'
    $entries = Get-ChildItem -LiteralPath $resolvedDirectory -File -Recurse -Force | Sort-Object FullName
    $digestLines = foreach ($entry in $entries) {
        $relativePath = $entry.FullName.Substring($resolvedDirectory.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar).Replace('\', '/')
        $fileHash = (Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
        "$fileHash  $relativePath"
    }

    $content = [System.Text.Encoding]::UTF8.GetBytes((@($digestLines) -join "`n"))
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($algorithm.ComputeHash($content))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}

function Read-OmnipotensCompanyManifest {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PackageRoot)

    $root = Resolve-CompanyDirectory -Path $PackageRoot -Description 'Package root'
    $manifestPath = Join-Path $root 'manifest/omnipotens-package.manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Package manifest was not found: $manifestPath"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Package manifest is not valid JSON: $manifestPath. $($_.Exception.Message)"
    }

    if ($manifest.schemaVersion -ne 1 -or $manifest.packageName -ne 'omnipotens-company') {
        throw 'Package manifest is not an Omnipotens company package (schemaVersion 1 expected).'
    }

    if (@($manifest.skills).Count -eq 0) {
        throw 'Package manifest does not declare any skills.'
    }

    return [PSCustomObject]@{
        Root = $root
        Path = $manifestPath
        Value = $manifest
    }
}

function Read-OmnipotensCompanyPolicy {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PolicyPath)

    if (-not (Test-Path -LiteralPath $PolicyPath -PathType Leaf)) {
        throw "Policy file was not found: $PolicyPath"
    }
    try {
        $policy = Get-Content -LiteralPath $PolicyPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Policy file is not valid JSON: $PolicyPath. $($_.Exception.Message)"
    }
    if ($policy.schemaVersion -ne 1 -or [string]::IsNullOrWhiteSpace($policy.policyName)) {
        throw "Policy file is not a supported company policy: $PolicyPath"
    }
    return $policy
}

function Find-BlockedCompanyFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][object]$Policy
    )

    $resolvedRoot = Resolve-CompanyDirectory -Path $Root -Description 'Workspace root'
    $blockedNames = @($Policy.blockedFileNames | ForEach-Object { $_.ToString() })
    if ($blockedNames.Count -eq 0) {
        return @()
    }

    $blocked = [System.Collections.Generic.List[object]]::new()
    $items = Get-ChildItem -LiteralPath $resolvedRoot -Force -File -Recurse -ErrorAction Stop
    foreach ($item in $items) {
        if ($blockedNames -contains $item.Name) {
            $blocked.Add([PSCustomObject]@{
                Name = $item.Name
                Path = $item.FullName
            })
        }
    }
    return $blocked.ToArray()
}

function Test-OmnipotensCompanyPackage {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PackageRoot)

    $manifestInfo = Read-OmnipotensCompanyManifest -PackageRoot $PackageRoot
    $result = [System.Collections.Generic.List[string]]::new()

    foreach ($skill in @($manifestInfo.Value.skills)) {
        if (-not (Test-CompanySkillName -Name $skill.name)) {
            throw "Manifest has an unsafe skill name: $($skill.name)"
        }
        if ([string]::IsNullOrWhiteSpace($skill.sha256) -or $skill.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
            throw "Manifest has no valid SHA-256 digest for skill '$($skill.name)'."
        }

        $skillDirectory = Assert-CompanyChildPath -Parent $manifestInfo.Root -Candidate (Join-Path $manifestInfo.Root $skill.source) -Description "Skill '$($skill.name)'"
        if (-not (Test-Path -LiteralPath $skillDirectory -PathType Container)) {
            throw "Skill directory is missing: $skillDirectory"
        }
        if (-not (Test-Path -LiteralPath (Join-Path $skillDirectory 'SKILL.md') -PathType Leaf)) {
            throw "Skill '$($skill.name)' has no SKILL.md."
        }

        $actualDigest = Get-CompanyDirectoryDigest -Directory $skillDirectory
        if ($actualDigest -ne $skill.sha256.ToLowerInvariant()) {
            throw "SHA-256 mismatch for skill '$($skill.name)'. Expected $($skill.sha256), received $actualDigest."
        }
        $result.Add("$($skill.name): $actualDigest")
    }

    $policyPath = Assert-CompanyChildPath -Parent $manifestInfo.Root -Candidate (Join-Path $manifestInfo.Root $manifestInfo.Value.policy.source) -Description 'Policy file'
    if (-not (Test-Path -LiteralPath $policyPath -PathType Leaf)) {
        throw "Policy file is missing: $policyPath"
    }
    if ([string]::IsNullOrWhiteSpace($manifestInfo.Value.policy.sha256) -or $manifestInfo.Value.policy.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'Package manifest has no valid SHA-256 digest for the policy file.'
    }
    $policyDigest = (Get-FileHash -LiteralPath $policyPath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    if ($policyDigest -ne $manifestInfo.Value.policy.sha256.ToLowerInvariant()) {
        throw "SHA-256 mismatch for the policy file. Expected $($manifestInfo.Value.policy.sha256), received $policyDigest."
    }

    return [PSCustomObject]@{
        PackageRoot = $manifestInfo.Root
        Version = $manifestInfo.Value.packageVersion
        Skills = $result
        PolicyDigest = $policyDigest
    }
}

function Remove-VerifiedCompanyDirectory {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string]$Parent,
        [Parameter(Mandatory)][string]$Directory
    )

    $safeDirectory = Assert-CompanyChildPath -Parent $Parent -Candidate $Directory -Description 'Directory removal target'
    if (Test-Path -LiteralPath $safeDirectory) {
        if ($PSCmdlet.ShouldProcess($safeDirectory, 'Remove verified staging directory')) {
            Remove-Item -LiteralPath $safeDirectory -Recurse -Force -ErrorAction Stop
        }
    }
}

Export-ModuleMember -Function @(
    'Resolve-CompanyDirectory',
    'Assert-CompanyChildPath',
    'Test-CompanySkillName',
    'Get-CompanyDirectoryDigest',
    'Read-OmnipotensCompanyManifest',
    'Read-OmnipotensCompanyPolicy',
    'Find-BlockedCompanyFiles',
    'Test-OmnipotensCompanyPackage',
    'Remove-VerifiedCompanyDirectory'
)
