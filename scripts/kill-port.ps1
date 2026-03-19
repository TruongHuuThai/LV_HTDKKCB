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

foreach ($processId in $pids) {
  try {
    $process = Get-Process -Id $processId -ErrorAction Stop
    Write-Host "Stopping PID $processId ($($process.ProcessName)) on port $Port..."
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not stop PID $processId. $($_.Exception.Message)"
  }
}

Write-Host "Port $Port has been released."
