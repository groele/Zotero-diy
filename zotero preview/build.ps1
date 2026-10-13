param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'dist'))
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$destination = Join-Path $OutputDirectory ('ZoteroPreview-' + $manifest.version + '.xpi')
& (Join-Path $PSScriptRoot 'scripts\build.ps1') -OutputPath $destination
