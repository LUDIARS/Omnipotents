[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$preflightPath = Join-Path $repositoryRoot 'scripts/Test-OmnipotensCompanyInput.ps1'
$policyPath = Join-Path $repositoryRoot 'config/omnipotens-company-policy.json'
$passed = 0

function Write-Utf8TestFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content
    )

    [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $Path))
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Assert-PreflightPasses {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Workspace
    )

    try {
        & $preflightPath -WorkspaceRoot $Workspace -Classification internal -PolicyPath $policyPath | Out-Null
    }
    catch {
        throw "FAIL: $Name was expected to pass: $($_.Exception.Message)"
    }
    $script:passed++
    Write-Host "PASS: $Name"
}

function Assert-PreflightFails {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Workspace,
        [Parameter(Mandatory)][string]$ExpectedMessage,
        [string]$Classification = 'internal'
    )

    $message = $null
    try {
        & $preflightPath `
            -WorkspaceRoot $Workspace `
            -Classification $Classification `
            -PolicyPath $policyPath | Out-Null
    }
    catch {
        $message = $_.Exception.Message
    }
    if ($null -eq $message) {
        throw "FAIL: $Name was expected to fail."
    }
    if ($message -notmatch $ExpectedMessage) {
        throw "FAIL: $Name failed for an unexpected reason: $message"
    }
    $script:passed++
    Write-Host "PASS: $Name"
}

$suiteRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("omnipotens-input-tests-" + [guid]::NewGuid().ToString('N'))
[void][System.IO.Directory]::CreateDirectory($suiteRoot)

try {
    $clean = Join-Path $suiteRoot 'clean'
    Write-Utf8TestFile -Path (Join-Path $clean 'design.md') -Content "# Clean game design`n"
    Assert-PreflightPasses -Name 'accepts explicitly classified clean input' -Workspace $clean

    $blockedName = Join-Path $suiteRoot 'blocked-name'
    Write-Utf8TestFile -Path (Join-Path $blockedName '.env.staging') -Content "PLACEHOLDER=true`n"
    Assert-PreflightFails -Name 'rejects an environment file variant' -Workspace $blockedName -ExpectedMessage 'sensitive filename'

    $blockedContent = Join-Path $suiteRoot 'blocked-content'
    $fakeToken = 'ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456'
    Write-Utf8TestFile -Path (Join-Path $blockedContent 'notes.md') -Content "token: $fakeToken`n"
    Assert-PreflightFails -Name 'rejects a high-confidence secret pattern' -Workspace $blockedContent -ExpectedMessage 'github-token'

    Assert-PreflightFails `
        -Name 'rejects a disallowed classification' `
        -Workspace $clean `
        -Classification confidential `
        -ExpectedMessage 'not permitted by policy'

    Write-Host "All $passed company input preflight tests passed."
}
finally {
    if (Test-Path -LiteralPath $suiteRoot -PathType Container) {
        $resolvedSuiteRoot = (Resolve-Path -LiteralPath $suiteRoot -ErrorAction Stop).Path
        $expectedParent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/')
        $actualParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $resolvedSuiteRoot)).TrimEnd('\', '/')
        $comparison = if ([System.IO.Path]::DirectorySeparatorChar -eq '\') {
            [System.StringComparison]::OrdinalIgnoreCase
        }
        else {
            [System.StringComparison]::Ordinal
        }
        if (-not $actualParent.Equals($expectedParent, $comparison)) {
            throw "Refusing to remove test directory outside the temporary root: $resolvedSuiteRoot"
        }
        Remove-Item -LiteralPath $resolvedSuiteRoot -Recurse -Force
    }
}
