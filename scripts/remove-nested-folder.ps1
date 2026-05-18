# Run after closing Cursor/terminals that have D:\GlowDaily\glowdaily open.
$nested = Join-Path $PSScriptRoot "..\glowdaily"
$renamed = Join-Path $PSScriptRoot "..\_remove_glowdaily"

foreach ($path in @($nested, $renamed)) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
    Write-Host "Removed $path"
  }
}

Write-Host "Done."
