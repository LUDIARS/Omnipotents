[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

Get-Command -Name git -ErrorAction Stop | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $RepositoryRoot '.git'))) {
    throw "RepositoryRoot is not a Git repository: $RepositoryRoot"
}

$root = (Resolve-Path -LiteralPath $RepositoryRoot -ErrorAction Stop).Path
& git -C $root submodule sync --recursive
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to synchronize Omnipotens submodule URLs.'
}

& git -C $root submodule update --init --recursive
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to initialize Omnipotens submodules.'
}

Write-Host "Initialized Omnipotens dependencies under $root"
