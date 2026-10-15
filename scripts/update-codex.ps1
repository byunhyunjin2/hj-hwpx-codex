# hj-hwpx-codex를 Codex에 설치하거나 새 ZIP으로 업데이트한다.
# 사용: powershell -ExecutionPolicy Bypass -File update-codex.ps1 -Zip <hj-hwpx-codex-x.y.z.zip>
# 로컬 마켓플레이스는 기본으로 %LOCALAPPDATA%\hj-hwpx-marketplace에 만든다.
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [string]$MarketplaceRoot = (Join-Path $env:LOCALAPPDATA 'hj-hwpx-marketplace')
)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($MarketplaceRoot)
New-Item -ItemType Directory -Force $root | Out-Null
$plugins = Join-Path $root 'plugins'
$target = Join-Path $plugins 'hj-hwpx-codex'
$zipPath = (Resolve-Path -LiteralPath $Zip).Path

$codex = (Get-Command codex -ErrorAction SilentlyContinue).Source
if (-not $codex) {
  $codex = Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin\*\codex.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $codex) { throw 'codex.exe를 찾지 못했습니다. Codex 앱을 먼저 설치하세요.' }

# 이전 버전 폴더는 휴지통으로 보낸다.
if (Test-Path -LiteralPath $target) {
  Add-Type -AssemblyName Microsoft.VisualBasic
  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($target, 'OnlyErrorDialogs', 'SendToRecycleBin')
}
New-Item -ItemType Directory -Force $plugins | Out-Null
& "$env:SystemRoot\System32\tar.exe" -xf $zipPath -C $plugins
if ($LASTEXITCODE) { throw 'ZIP 압축 해제 실패' }

$manifestPath = Join-Path $target '.codex-plugin\plugin.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'ZIP 안에 hj-hwpx-codex/.codex-plugin/plugin.json이 없습니다.' }
$version = ([System.IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json).version
# Codex는 루트 plugin.json의 버전을 쓰므로 두 매니페스트 버전이 같아야 한다.
$rootManifest = Join-Path $target 'plugin.json'
if (Test-Path -LiteralPath $rootManifest) {
  $rootVersion = ([System.IO.File]::ReadAllText($rootManifest) | ConvertFrom-Json).version
  if ($rootVersion -ne $version) { throw "버전 불일치: plugin.json $rootVersion / .codex-plugin/plugin.json $version" }
}

$marketplace = [ordered]@{
  name = 'hj-hwpx'
  interface = @{ displayName = 'hj-hwpx (local)' }
  plugins = @([ordered]@{
    name = 'hj-hwpx-codex'
    version = $version
    source = @{ source = 'local'; path = './plugins/hj-hwpx-codex' }
    policy = @{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
    category = 'Productivity'
  })
}
$marketplaceDir = Join-Path $root '.agents\plugins'
New-Item -ItemType Directory -Force $marketplaceDir | Out-Null
[System.IO.File]::WriteAllText((Join-Path $marketplaceDir 'marketplace.json'), ($marketplace | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))

if (-not ((& $codex plugin marketplace list) -match 'hj-hwpx')) { & $codex plugin marketplace add $root }
& $codex plugin add 'hj-hwpx-codex@hj-hwpx'
if ($LASTEXITCODE) { throw 'codex plugin add 실패' }

$installed = (& $codex plugin list) -match 'hj-hwpx-codex@hj-hwpx'
Write-Host $installed
if (-not ($installed -match [regex]::Escape($version))) { throw "설치된 버전이 $version 이 아닙니다." }
Write-Host "완료: hj-hwpx-codex $version. Codex에서 새 대화를 열어야 새 버전이 적용됩니다."
