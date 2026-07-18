[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

function Invoke-DotNetChecked {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Executable,

        [Parameter(Mandatory)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory)]
        [string[]]$DotNetArguments
    )

    $previousLocation = Get-Location
    try {
        Set-Location -LiteralPath $WorkingDirectory
        & $Executable @DotNetArguments
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet exited with code $LASTEXITCODE."
        }
    }
    finally {
        Set-Location -LiteralPath $previousLocation.Path
    }
}

$repositoryRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot) -ErrorAction Stop).Path
$testProject = Join-Path $repositoryRoot 'tools\Omnipotens.AnalysisPlanner.Tests\Omnipotens.AnalysisPlanner.Tests.csproj'
$applicationProject = Join-Path $repositoryRoot 'tools\Omnipotens.AnalysisPlanner\Omnipotens.AnalysisPlanner.csproj'
$catalogPath = Join-Path $repositoryRoot '.claude\skills\omnipotens\references\service-analysis-catalog.json'
$releaseDirectory = Join-Path $repositoryRoot 'release\omnipotens-analysis-planner'
$publishedExecutable = Join-Path $releaseDirectory 'Omnipotens.AnalysisPlanner.exe'

foreach ($requiredFile in @($testProject, $applicationProject, $catalogPath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required file is missing: $requiredFile"
    }
}

$dotnet = (Get-Command 'dotnet' -CommandType Application -ErrorAction Stop).Source

Write-Host 'Running Omnipotens Analysis Planner test harness...'
Invoke-DotNetChecked -Executable $dotnet -WorkingDirectory $repositoryRoot -DotNetArguments @(
    'run',
    '--project', $testProject,
    '--configuration', 'Release'
)

if (-not (Test-Path -LiteralPath $releaseDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $releaseDirectory -ErrorAction Stop | Out-Null
}

Write-Host 'Publishing win-x64 single-file executable...'
Invoke-DotNetChecked -Executable $dotnet -WorkingDirectory $repositoryRoot -DotNetArguments @(
    'publish',
    $applicationProject,
    '--configuration', 'Release',
    '--runtime', 'win-x64',
    '--self-contained', 'true',
    '--output', $releaseDirectory,
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:DebugType=None',
    '-p:DebugSymbols=false'
)

if (-not (Test-Path -LiteralPath $publishedExecutable -PathType Leaf)) {
    throw "Publish completed without the expected executable: $publishedExecutable"
}

Write-Host "Published: $publishedExecutable"
