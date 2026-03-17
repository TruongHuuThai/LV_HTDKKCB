$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$backendDir = Join-Path $repoRoot 'backend'
$killScript = Join-Path $PSScriptRoot 'kill-port.ps1'

& $killScript -Port 3000

Set-Location $backendDir
Write-Host 'Starting backend in watch mode on port 3000...'
& npm.cmd run start:dev
