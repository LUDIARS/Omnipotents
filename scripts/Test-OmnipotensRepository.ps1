[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:PathComparison = if ([System.IO.Path]::DirectorySeparatorChar -eq '\') {
    [System.StringComparison]::OrdinalIgnoreCase
}
else {
    [System.StringComparison]::Ordinal
}

function Invoke-GitCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$GitExecutable,

        [Parameter(Mandatory)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $commandArguments = @('-C', $WorkingDirectory) + $Arguments
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # Windows PowerShell promotes native stderr to ErrorRecord objects. The
        # process exit code remains the authoritative success signal.
        $ErrorActionPreference = 'Continue'
        $output = @(& $GitExecutable @commandArguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $outputLines = @($output | ForEach-Object { $_.ToString() })

    if ($exitCode -ne 0) {
        $diagnostics = $outputLines -join [Environment]::NewLine
        if ([string]::IsNullOrWhiteSpace($diagnostics)) {
            $diagnostics = '(no diagnostic output)'
        }

        throw "Git command failed with exit code ${exitCode}: git $($Arguments -join ' ')`n$diagnostics"
    }

    return $outputLines
}

function Get-NormalizedPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Get-DeclaredSubmodulePaths {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$GitExecutable,

        [Parameter(Mandatory)]
        [string]$RepositoryPath
    )

    $gitmodulesPath = Join-Path $RepositoryPath '.gitmodules'
    if (-not (Test-Path -LiteralPath $gitmodulesPath -PathType Leaf)) {
        return @()
    }

    $configLines = @(
        Invoke-GitCommand `
            -GitExecutable $GitExecutable `
            -WorkingDirectory $RepositoryPath `
            -Arguments @('config', '--file', '.gitmodules', '--get-regexp', '^submodule\..*\.path$')
    )

    if ($configLines.Count -eq 0) {
        throw "The .gitmodules file declares no submodule paths: $RepositoryPath"
    }

    $paths = @()
    $seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($line in $configLines) {
        if ($line -notmatch '^submodule\..+\.path\s+(?<path>.+)$') {
            throw "Unable to parse a submodule path from .gitmodules: $line"
        }

        $relativePath = $Matches.path.Trim().Replace('\', '/')
        if ([string]::IsNullOrWhiteSpace($relativePath) -or [System.IO.Path]::IsPathRooted($relativePath)) {
            throw "Unsafe submodule path in .gitmodules: $relativePath"
        }

        if (-not $seenPaths.Add($relativePath)) {
            throw "Duplicate submodule path in .gitmodules: $relativePath"
        }

        $paths += $relativePath
    }

    return $paths
}

function Get-GitIndexRecords {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$GitExecutable,

        [Parameter(Mandatory)]
        [string]$RepositoryPath,

        [string]$RelativePath
    )

    $arguments = @('-c', 'core.quotePath=false', 'ls-files', '--stage')
    if (-not [string]::IsNullOrEmpty($RelativePath)) {
        $arguments += @('--', $RelativePath)
    }

    $indexLines = @(
        Invoke-GitCommand `
            -GitExecutable $GitExecutable `
            -WorkingDirectory $RepositoryPath `
            -Arguments $arguments
    )

    $records = @()
    foreach ($line in $indexLines) {
        if ($line -notmatch '^(?<mode>[0-9]{6}) (?<sha>[0-9a-fA-F]{40,64}) (?<stage>[0-3])\t(?<path>.+)$') {
            throw "Unable to parse a Git index record: $line"
        }

        $records += [pscustomobject]@{
            Mode  = $Matches.mode
            Sha   = $Matches.sha.ToLowerInvariant()
            Stage = [int]$Matches.stage
            Path  = $Matches.path.Replace('\', '/')
        }
    }

    return $records
}

function Assert-RepositoryIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$GitExecutable,

        [Parameter(Mandatory)]
        [string]$RepositoryPath,

        [Parameter(Mandatory)]
        [string]$DisplayPath
    )

    try {
        $topLevelLines = @(
            Invoke-GitCommand `
                -GitExecutable $GitExecutable `
                -WorkingDirectory $RepositoryPath `
                -Arguments @('rev-parse', '--show-toplevel')
        )
    }
    catch {
        throw "Submodule status '-' for '$DisplayPath': the submodule is not initialized or is not a readable Git worktree. $($_.Exception.Message)"
    }

    if ($topLevelLines.Count -ne 1) {
        throw "Submodule status '-' for '$DisplayPath': Git returned an ambiguous worktree root."
    }

    $expectedTopLevel = Get-NormalizedPath -Path $RepositoryPath
    $actualTopLevel = Get-NormalizedPath -Path $topLevelLines[0]
    if (-not $actualTopLevel.Equals($expectedTopLevel, $script:PathComparison)) {
        throw "Submodule status '-' for '$DisplayPath': the path resolves to '$actualTopLevel' instead of its own initialized worktree."
    }
}

function Assert-SubmoduleRepository {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$GitExecutable,

        [Parameter(Mandatory)]
        [string]$RepositoryPath,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$DisplayPrefix,

        [string[]]$DeclaredPaths
    )

    if ($null -eq $DeclaredPaths) {
        $DeclaredPaths = @(
            Get-DeclaredSubmodulePaths `
                -GitExecutable $GitExecutable `
                -RepositoryPath $RepositoryPath
        )
    }

    $declaredPathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($declaredPath in $DeclaredPaths) {
        [void]$declaredPathSet.Add($declaredPath)
    }

    $allIndexRecords = @(
        Get-GitIndexRecords `
            -GitExecutable $GitExecutable `
            -RepositoryPath $RepositoryPath
    )
    foreach ($gitlinkRecord in @($allIndexRecords | Where-Object { $_.Mode -eq '160000' })) {
        if (-not $declaredPathSet.Contains($gitlinkRecord.Path)) {
            $unregisteredPath = if ([string]::IsNullOrEmpty($DisplayPrefix)) {
                $gitlinkRecord.Path
            }
            else {
                "$DisplayPrefix/$($gitlinkRecord.Path)"
            }

            throw "Gitlink '$unregisteredPath' is not declared in .gitmodules."
        }
    }

    $normalizedRepositoryPath = Get-NormalizedPath -Path $RepositoryPath
    $repositoryPrefix = $normalizedRepositoryPath + [System.IO.Path]::DirectorySeparatorChar

    foreach ($relativePath in $DeclaredPaths) {
        $displayPath = if ([string]::IsNullOrEmpty($DisplayPrefix)) {
            $relativePath
        }
        else {
            "$DisplayPrefix/$relativePath"
        }

        $indexRecords = @(
            Get-GitIndexRecords `
                -GitExecutable $GitExecutable `
                -RepositoryPath $RepositoryPath `
                -RelativePath $relativePath
        )
        if (
            $indexRecords.Count -ne 1 -or
            $indexRecords[0].Mode -ne '160000' -or
            $indexRecords[0].Stage -ne 0
        ) {
            throw "Submodule status 'U' for '$displayPath': the index does not contain exactly one stage-0 gitlink."
        }

        $submodulePath = Get-NormalizedPath -Path (Join-Path $RepositoryPath $relativePath)
        if (-not $submodulePath.StartsWith($repositoryPrefix, $script:PathComparison)) {
            throw "Unsafe submodule path escapes its parent repository: $displayPath"
        }

        if (-not (Test-Path -LiteralPath $submodulePath -PathType Container)) {
            throw "Submodule status '-' for '$displayPath': the submodule is not initialized."
        }

        Assert-RepositoryIdentity `
            -GitExecutable $GitExecutable `
            -RepositoryPath $submodulePath `
            -DisplayPath $displayPath

        try {
            $headLines = @(
                Invoke-GitCommand `
                    -GitExecutable $GitExecutable `
                    -WorkingDirectory $submodulePath `
                    -Arguments @('rev-parse', '--verify', 'HEAD^{commit}')
            )
        }
        catch {
            throw "Submodule status '-' for '$displayPath': the checked-out HEAD cannot be resolved. $($_.Exception.Message)"
        }

        if ($headLines.Count -ne 1 -or $headLines[0] -notmatch '^[0-9a-fA-F]{40,64}$') {
            throw "Submodule status '-' for '$displayPath': Git returned an invalid HEAD object ID."
        }

        $recordedSha = $indexRecords[0].Sha
        $checkedOutSha = $headLines[0].ToLowerInvariant()
        if (-not $recordedSha.Equals($checkedOutSha, [System.StringComparison]::Ordinal)) {
            throw "Submodule status '+' for '$displayPath': recorded gitlink $recordedSha does not match checked-out HEAD $checkedOutSha."
        }

        Assert-SubmoduleRepository `
            -GitExecutable $GitExecutable `
            -RepositoryPath $submodulePath `
            -DisplayPrefix $displayPath

        $worktreeStatus = @(
            Invoke-GitCommand `
                -GitExecutable $GitExecutable `
                -WorkingDirectory $submodulePath `
                -Arguments @('status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none')
        )
        if ($worktreeStatus.Count -ne 0) {
            throw "Submodule worktree is not clean: $displayPath`n$($worktreeStatus -join [Environment]::NewLine)"
        }
    }
}

$requiredPaths = @(
    '.claude/skills/omnipotens/SKILL.md',
    '.claude/skills/omnipotens/references/input-boundary-policy.json',
    '.claude/skills/omnipotens/references/untrusted-source-boundary.md',
    '.claude/skills/omnipotens/references/vitia-ux-integration.md',
    '.claude/skills/omnipotens/scripts/omnipotens-input-gate.mjs',
    '.claude/skills/omnipotens/scripts/vitia-source-manifest.mjs',
    '.claude/skills/omnipotens/scripts/lib/vitia-source.mjs',
    'dependencies/Anatomia/bin/anatomia.mjs',
    'dependencies/Ludus/spec/data/okf/README.md'
)

$requiredSubmodulePaths = @(
    'dependencies/Anatomia',
    'dependencies/Ludus'
)

$root = (Resolve-Path -LiteralPath $RepositoryRoot -ErrorAction Stop).Path
$gitCommand = @(Get-Command git -CommandType Application -ErrorAction Stop)[0]
$gitExecutable = $gitCommand.Source

$rootTopLevel = @(
    Invoke-GitCommand `
        -GitExecutable $gitExecutable `
        -WorkingDirectory $root `
        -Arguments @('rev-parse', '--show-toplevel')
)
if ($rootTopLevel.Count -ne 1) {
    throw "Unable to determine the repository root: $root"
}

$normalizedRoot = Get-NormalizedPath -Path $root
$normalizedTopLevel = Get-NormalizedPath -Path $rootTopLevel[0]
if (-not $normalizedRoot.Equals($normalizedTopLevel, $script:PathComparison)) {
    throw "RepositoryRoot must identify the Git worktree root. Expected '$normalizedTopLevel', received '$normalizedRoot'."
}

$rootSubmodulePaths = @(
    Get-DeclaredSubmodulePaths `
        -GitExecutable $gitExecutable `
        -RepositoryPath $root
)
$rootSubmodulePathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($submodulePath in $rootSubmodulePaths) {
    [void]$rootSubmodulePathSet.Add($submodulePath)
}

foreach ($requiredSubmodulePath in $requiredSubmodulePaths) {
    if (-not $rootSubmodulePathSet.Contains($requiredSubmodulePath)) {
        throw "Required Omnipotens submodule is not declared in .gitmodules: $requiredSubmodulePath"
    }
}

Assert-SubmoduleRepository `
    -GitExecutable $gitExecutable `
    -RepositoryPath $root `
    -DisplayPrefix '' `
    -DeclaredPaths $rootSubmodulePaths

foreach ($relativePath in $requiredPaths) {
    $absolutePath = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        throw "Required Omnipotents artifact is missing: $relativePath. Run Initialize-OmnipotensDependencies.ps1 before retrying."
    }
}

Write-Host "Omnipotents repository verification passed: $root"
