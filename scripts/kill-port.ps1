param(
  [Parameter(Mandatory = $false)]
  [int]$Port = 3000
)

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
  Write-Host "Port $Port is already free."
  exit 0
}

$pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pid in $pids) {
  try {
    $process = Get-Process -Id $pid -ErrorAction Stop
    Write-Host "Stopping PID $pid ($($process.ProcessName)) on port $Port..."
    Stop-Process -Id $pid -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not stop PID $pid. $($_.Exception.Message)"
  }
}

Write-Host "Port $Port has been released."
