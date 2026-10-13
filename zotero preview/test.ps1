$ErrorActionPreference = 'Stop'
foreach ($file in @('bootstrap.js','zoteropreview.js','zoteropreview_prefs.js')) {
    node --check (Join-Path $PSScriptRoot $file)
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $file" }
}
node --test (Join-Path $PSScriptRoot 'tests\native-sidebar.test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Native sidebar regressions failed' }
& (Join-Path $PSScriptRoot 'build.ps1')
node --test (Join-Path $PSScriptRoot 'tests\release.test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Release consistency checks failed' }
Write-Host 'Runtime regressions, syntax, XPI payload hashes, and update-feed checks passed.'
