$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction Stop
$jsFiles = @('bootstrap.js', 'zoteropreview.js', 'zoteropreview_prefs.js')
foreach ($file in $jsFiles) {
    & $node.Source --check (Join-Path $projectRoot $file)
    if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $file" }
}
& $node.Source --test (Join-Path $projectRoot 'tests\zoteropreview.test.js')
if ($LASTEXITCODE -ne 0) { throw 'Node.js test suite failed.' }
& (Join-Path $projectRoot 'scripts\build.ps1')
if ($LASTEXITCODE -ne 0) { throw 'XPI build failed.' }
Write-Host 'All static tests and XPI package checks passed.'
