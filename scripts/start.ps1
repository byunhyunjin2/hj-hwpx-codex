param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [string]$PlanPath
)
$ErrorActionPreference = 'Stop'
$pluginDirectory = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $pluginDirectory 'runtime/win32-x64/node.exe'
$entryPath = Join-Path $pluginDirectory 'server/main.cjs'
$documentPath = (Resolve-Path -LiteralPath $InputPath).Path
$resultDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($PlanPath) {
  $reviewPlanPath = (Resolve-Path -LiteralPath $PlanPath).Path
  & $runtimePath $entryPath $documentPath $resultDirectory $reviewPlanPath
} else {
  & $runtimePath $entryPath $documentPath $resultDirectory
}
exit $LASTEXITCODE
