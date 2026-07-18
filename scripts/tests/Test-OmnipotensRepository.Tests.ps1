[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

$script:GitExecutable = @(Get-Command git -CommandType Application -ErrorAction Stop)[0].Source
$script:VerifierPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Test-OmnipotensRepository.ps1'
$script:PassedTestCount = 0
$script:PathComparison = if ([System.IO.Path]::DirectorySeparatorChar -eq '\') {
    [System.StringComparison]::OrdinalIgnoreCase
}
else {
    [System.StringComparison]::Ordinal
}

function Invoke-FixtureGit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $commandArguments = @('-C', $WorkingDirectory) + $Arguments
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $script:GitExecutable @commandArguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "Fixture Git command failed with exit code ${exitCode}: git $($Arguments -join ' ')`n$($output -join [Environment]::NewLine)"
    }

    return @($output | ForEach-Object { $_.ToString() })
}

function Write-Utf8FixtureFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Content
    )

    $directory = Split-Path -Parent $Path
    [void][System.IO.Directory]::CreateDirectory($directory)
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Initialize-FixtureRepository {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    [void][System.IO.Directory]::CreateDirectory($Path)
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('init', '--quiet'))
    [void][System.IO.Directory]::CreateDirectory((Join-Path $Path '.git/fixture-hooks'))
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('config', 'core.hooksPath', '.git/fixture-hooks'))
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('config', 'user.name', 'Omnipotens Test'))
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('config', 'user.email', 'omnipotens-test@example.invalid'))
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('config', 'core.autocrlf', 'false'))
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('config', 'advice.addEmbeddedRepo', 'false'))
}

function Save-FixtureCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Message
    )

    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('add', '--all'))
    [void](Invoke-FixtureGit -WorkingDirectory $Path -Arguments @('commit', '--quiet', '-m', $Message))
}

function New-RepositoryFixture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$SuiteRoot,

        [Parameter(Mandatory)]
        [string]$Name
    )

    $repositoryRoot = Join-Path $SuiteRoot $Name
    Initialize-FixtureRepository -Path $repositoryRoot

    $anatomiaPath = Join-Path $repositoryRoot 'dependencies/Anatomia'
    Initialize-FixtureRepository -Path $anatomiaPath
    $nestedPath = Join-Path $anatomiaPath 'vendor/Nested'
    Initialize-FixtureRepository -Path $nestedPath
    Write-Utf8FixtureFile -Path (Join-Path $nestedPath 'nested.txt') -Content "nested baseline`n"
    Save-FixtureCommit -Path $nestedPath -Message 'Initialize nested dependency'
    Write-Utf8FixtureFile -Path (Join-Path $anatomiaPath 'bin/anatomia.mjs') -Content "export const fixture = true;`n"
    Write-Utf8FixtureFile -Path (Join-Path $anatomiaPath '.gitmodules') -Content @"
[submodule "vendor/Nested"]
	path = vendor/Nested
	url = ../nested-source
"@
    Save-FixtureCommit -Path $anatomiaPath -Message 'Initialize Anatomia fixture'

    $ludusPath = Join-Path $repositoryRoot 'dependencies/Ludus'
    Initialize-FixtureRepository -Path $ludusPath
    Write-Utf8FixtureFile -Path (Join-Path $ludusPath 'spec/data/okf/README.md') -Content "Ludus fixture`n"
    Save-FixtureCommit -Path $ludusPath -Message 'Initialize Ludus fixture'

    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.gitmodules') -Content @"
[submodule "dependencies/Anatomia"]
	path = dependencies/Anatomia
	url = ../anatomia-source
[submodule "dependencies/Ludus"]
	path = dependencies/Ludus
	url = ../ludus-source
"@
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/SKILL.md') -Content "fixture`n"
    $requiredPlannerFixturePaths = @(
        '.claude/skills/omnipotens/agents/openai.yaml',
        '.claude/skills/omnipotens/references/artifact-contract.md',
        '.claude/skills/omnipotens/references/service-analysis.md',
        '.claude/skills/omnipotens/references/service-analysis-catalog.json',
        '.claude/skills/omnipotens/scripts/omnipotens-service-cache.mjs',
        '.claude/skills/omnipotens/scripts/test-service-analysis.mjs',
        '.claude/skills/omnipotens/scripts/lib/analysis-run-plan.mjs',
        '.claude/skills/omnipotens/scripts/lib/atomic-json-file.mjs',
        '.claude/skills/omnipotens/scripts/lib/service-analysis-cache.mjs',
        '.claude/skills/omnipotens/scripts/lib/service-analysis-catalog.mjs',
        '.claude/skills/omnipotens/scripts/lib/service-analysis-cli-options.mjs',
        'scripts/Publish-OmnipotensPlanner.ps1',
        'tools/Omnipotens.AnalysisPlanner/Omnipotens.AnalysisPlanner.csproj',
        'tools/Omnipotens.AnalysisPlanner.Core/Omnipotens.AnalysisPlanner.Core.csproj',
        'tools/Omnipotens.AnalysisPlanner.Tests/Omnipotens.AnalysisPlanner.Tests.csproj'
    )
    foreach ($relativePath in $requiredPlannerFixturePaths) {
        Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot $relativePath) -Content "fixture`n"
    }
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/references/input-boundary-policy.json') -Content "{}`n"
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/references/untrusted-source-boundary.md') -Content "fixture`n"
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/references/vitia-ux-integration.md') -Content "fixture`n"
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/scripts/omnipotens-input-gate.mjs') -Content "export {};`n"
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/scripts/vitia-source-manifest.mjs') -Content "export {};`n"
    Write-Utf8FixtureFile -Path (Join-Path $repositoryRoot '.claude/skills/omnipotens/scripts/lib/vitia-source.mjs') -Content "export {};`n"
    Save-FixtureCommit -Path $repositoryRoot -Message 'Initialize verifier fixture'

    return $repositoryRoot
}

function Copy-RepositoryFixture {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$SuiteRoot,

        [Parameter(Mandatory)]
        [string]$TemplatePath,

        [Parameter(Mandatory)]
        [string]$Name
    )

    $destination = Join-Path $SuiteRoot $Name
    Copy-Item -LiteralPath $TemplatePath -Destination $destination -Recurse -Force
    return $destination
}

function Assert-VerificationPasses {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [string]$RepositoryRoot
    )

    try {
        & $script:VerifierPath -RepositoryRoot $RepositoryRoot | Out-Null
    }
    catch {
        throw "FAIL: $Name was expected to pass, but failed: $($_.Exception.Message)"
    }

    $script:PassedTestCount++
    Write-Host "PASS: $Name"
}

function Assert-VerificationFails {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [string]$ExpectedMessagePattern
    )

    $failureMessage = $null
    try {
        & $script:VerifierPath -RepositoryRoot $RepositoryRoot | Out-Null
    }
    catch {
        $failureMessage = $_.Exception.Message
    }

    if ($null -eq $failureMessage) {
        throw "FAIL: $Name was expected to fail, but passed."
    }

    if ($failureMessage -notmatch $ExpectedMessagePattern) {
        throw "FAIL: $Name failed for an unexpected reason: $failureMessage"
    }

    $script:PassedTestCount++
    Write-Host "PASS: $Name"
}

function Add-FixtureCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryPath,

        [Parameter(Mandatory)]
        [string]$RelativePath
    )

    Write-Utf8FixtureFile -Path (Join-Path $RepositoryPath $RelativePath) -Content "new commit`n"
    Save-FixtureCommit -Path $RepositoryPath -Message 'Advance fixture HEAD'
}

function Set-FixtureGitlinkConflict {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [string]$RelativePath
    )

    $submodulePath = Join-Path $RepositoryRoot $RelativePath
    $rootBaseBranch = @(Invoke-FixtureGit -WorkingDirectory $RepositoryRoot -Arguments @('symbolic-ref', '--short', 'HEAD'))[0]
    $submoduleBaseBranch = @(Invoke-FixtureGit -WorkingDirectory $submodulePath -Arguments @('symbolic-ref', '--short', 'HEAD'))[0]

    [void](Invoke-FixtureGit -WorkingDirectory $submodulePath -Arguments @('checkout', '--quiet', '-b', 'gitlink-left'))
    Write-Utf8FixtureFile -Path (Join-Path $submodulePath 'left.txt') -Content "left`n"
    Save-FixtureCommit -Path $submodulePath -Message 'Create left gitlink commit'
    [void](Invoke-FixtureGit -WorkingDirectory $RepositoryRoot -Arguments @('checkout', '--quiet', '-b', 'gitlink-left-root'))
    Save-FixtureCommit -Path $RepositoryRoot -Message 'Record left gitlink'

    [void](Invoke-FixtureGit -WorkingDirectory $RepositoryRoot -Arguments @('checkout', '--quiet', $rootBaseBranch))
    [void](Invoke-FixtureGit -WorkingDirectory $submodulePath -Arguments @('checkout', '--quiet', $submoduleBaseBranch))
    [void](Invoke-FixtureGit -WorkingDirectory $submodulePath -Arguments @('checkout', '--quiet', '-b', 'gitlink-right'))
    Write-Utf8FixtureFile -Path (Join-Path $submodulePath 'right.txt') -Content "right`n"
    Save-FixtureCommit -Path $submodulePath -Message 'Create right gitlink commit'
    [void](Invoke-FixtureGit -WorkingDirectory $RepositoryRoot -Arguments @('checkout', '--quiet', '-b', 'gitlink-right-root'))
    Save-FixtureCommit -Path $RepositoryRoot -Message 'Record right gitlink'

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $mergeOutput = @(& $script:GitExecutable -C $RepositoryRoot merge --no-edit gitlink-left-root 2>&1)
        $mergeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($mergeExitCode -eq 0) {
        throw "Expected divergent gitlinks to conflict, but Git merged them cleanly: $($mergeOutput -join [Environment]::NewLine)"
    }
}

function Remove-FixtureDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$AllowedRoot
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return
    }

    $normalizedPath = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path).TrimEnd('\', '/')
    $normalizedAllowedRoot = [System.IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\', '/')
    $allowedPrefix = $normalizedAllowedRoot + [System.IO.Path]::DirectorySeparatorChar
    if (-not $normalizedPath.StartsWith($allowedPrefix, $script:PathComparison)) {
        throw "Refusing to remove fixture directory outside the test suite root: $normalizedPath"
    }

    Get-ChildItem -LiteralPath $normalizedPath -Recurse -Force | ForEach-Object {
        if (-not $_.PSIsContainer -and $_.IsReadOnly) {
            $_.IsReadOnly = $false
        }
    }
    Remove-Item -LiteralPath $normalizedPath -Recurse -Force
}

$suiteRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("omnipotens-repository-tests-" + [guid]::NewGuid().ToString('N'))
[void][System.IO.Directory]::CreateDirectory($suiteRoot)

try {
    $templateFixture = New-RepositoryFixture -SuiteRoot $suiteRoot -Name 'template'
    Assert-VerificationPasses -Name 'accepts initialized, matching, recursively clean submodules' -RepositoryRoot $templateFixture

    $uninitializedFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'uninitialized-top-level'
    Remove-FixtureDirectory -Path (Join-Path $uninitializedFixture 'dependencies/Ludus') -AllowedRoot $suiteRoot
    Assert-VerificationFails `
        -Name 'rejects an uninitialized top-level submodule' `
        -RepositoryRoot $uninitializedFixture `
        -ExpectedMessagePattern "status '-'"

    $nestedUninitializedFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'uninitialized-nested'
    Remove-FixtureDirectory -Path (Join-Path $nestedUninitializedFixture 'dependencies/Anatomia/vendor/Nested') -AllowedRoot $suiteRoot
    Assert-VerificationFails `
        -Name 'rejects an uninitialized nested submodule' `
        -RepositoryRoot $nestedUninitializedFixture `
        -ExpectedMessagePattern "status '-'"

    $mismatchedFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'mismatched-top-level'
    Add-FixtureCommit -RepositoryPath (Join-Path $mismatchedFixture 'dependencies/Ludus') -RelativePath 'mismatch.txt'
    Assert-VerificationFails `
        -Name 'rejects a top-level gitlink and HEAD mismatch' `
        -RepositoryRoot $mismatchedFixture `
        -ExpectedMessagePattern "status '\+'"

    $nestedMismatchFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'mismatched-nested'
    Add-FixtureCommit -RepositoryPath (Join-Path $nestedMismatchFixture 'dependencies/Anatomia/vendor/Nested') -RelativePath 'mismatch.txt'
    Assert-VerificationFails `
        -Name 'rejects a nested gitlink and HEAD mismatch' `
        -RepositoryRoot $nestedMismatchFixture `
        -ExpectedMessagePattern "status '\+'"

    $conflictFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'gitlink-conflict'
    Set-FixtureGitlinkConflict -RepositoryRoot $conflictFixture -RelativePath 'dependencies/Ludus'
    Assert-VerificationFails `
        -Name 'rejects a conflicted gitlink' `
        -RepositoryRoot $conflictFixture `
        -ExpectedMessagePattern "status 'U'"

    $dirtyFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'dirty-top-level'
    Write-Utf8FixtureFile -Path (Join-Path $dirtyFixture 'dependencies/Ludus/spec/data/okf/README.md') -Content "dirty`n"
    Assert-VerificationFails `
        -Name 'rejects tracked changes in a submodule worktree' `
        -RepositoryRoot $dirtyFixture `
        -ExpectedMessagePattern 'worktree is not clean'

    $nestedDirtyFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'dirty-nested'
    Write-Utf8FixtureFile -Path (Join-Path $nestedDirtyFixture 'dependencies/Anatomia/vendor/Nested/nested.txt') -Content "dirty`n"
    Assert-VerificationFails `
        -Name 'rejects tracked changes in a nested submodule worktree' `
        -RepositoryRoot $nestedDirtyFixture `
        -ExpectedMessagePattern 'worktree is not clean'

    $nestedUntrackedFixture = Copy-RepositoryFixture -SuiteRoot $suiteRoot -TemplatePath $templateFixture -Name 'untracked-nested'
    Write-Utf8FixtureFile -Path (Join-Path $nestedUntrackedFixture 'dependencies/Anatomia/vendor/Nested/untracked.txt') -Content "untracked`n"
    Assert-VerificationFails `
        -Name 'rejects untracked files in a nested submodule worktree' `
        -RepositoryRoot $nestedUntrackedFixture `
        -ExpectedMessagePattern 'worktree is not clean'

    Write-Host "All $script:PassedTestCount repository verification tests passed."
}
finally {
    if (Test-Path -LiteralPath $suiteRoot -PathType Container) {
        $suiteParent = Split-Path -Parent $suiteRoot
        Remove-FixtureDirectory -Path $suiteRoot -AllowedRoot $suiteParent
    }
}
