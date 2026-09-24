param(
    [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\ZoteroPreview-40.0.1.xpi')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'manifest.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.version -ne '40.0.1') {
    throw "Expected manifest version 40.0.1; found '$($manifest.version)'. Update this build script and update feed together when changing versions."
}

$runtimeFiles = @(
    'manifest.json', 'bootstrap.js', 'prefs.js', 'prefs.xhtml', 'style.css',
    'view.svg', 'zoteropreview.js', 'zoteropreview_prefs.js', 'zoteropreview7-updates.json'
)
$entries = [System.Collections.Generic.List[object]]::new()
foreach ($file in $runtimeFiles) {
    $path = Join-Path $projectRoot $file
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing runtime file: $file" }
    $entries.Add([pscustomobject]@{ Source = $path; Name = $file })
}
$localeRoot = Join-Path $projectRoot 'locale'
foreach ($file in Get-ChildItem -LiteralPath $localeRoot -File -Recurse | Sort-Object FullName) {
    $relative = [IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\', '/')
    $entries.Add([pscustomobject]@{ Source = $file.FullName; Name = $relative })
}
if (-not ($entries.Name -contains 'locale/en-US/zotero-preview.ftl')) {
    throw 'Required Fluent resource locale/en-US/zotero-preview.ftl is missing.'
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
if (Test-Path -LiteralPath $resolvedOutput) { Remove-Item -LiteralPath $resolvedOutput -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($resolvedOutput, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($entry in $entries) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $entry.Source, $entry.Name, [IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally { $archive.Dispose() }

# Reopen and verify the generated XPI against the exact source manifest.
$check = [IO.Compression.ZipFile]::OpenRead($resolvedOutput)
try {
    $names = @($check.Entries | ForEach-Object FullName)
    foreach ($entry in $entries) {
        if ($names -notcontains $entry.Name) { throw "Build verification failed: missing $($entry.Name)" }
    }
    $manifestEntry = $check.GetEntry('manifest.json')
    $reader = [IO.StreamReader]::new($manifestEntry.Open())
    try { $builtManifest = $reader.ReadToEnd() | ConvertFrom-Json }
    finally { $reader.Dispose() }
    if ($builtManifest.version -ne $manifest.version) { throw 'XPI manifest does not match source manifest.' }
}
finally { $check.Dispose() }

Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput | Format-List | Out-String | Write-Host
Write-Host "Built $resolvedOutput ($($entries.Count) runtime files)."
