# KinSpan — always use this script so you get the latest code (not a stale port).
param(
  [switch]$Fresh  # Wipe kinspan.db once (demo only). Omit to keep existing profiles.
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$port = 8003
foreach ($p in 8000, 8001, 8002, 8003) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

if ($Fresh -or $env:KINSPAN_DEMO_FRESH -eq "1") {
  $db = Join-Path $PSScriptRoot "data\kinspan.db"
  if (Test-Path $db) {
    Remove-Item $db -Force
    Write-Host "Demo: cleared $db (no seeded profiles)" -ForegroundColor Yellow
  }
  if ($env:KINSPAN_DEMO_FRESH -eq "1" -and -not $Fresh) {
    Write-Host "Tip: unset KINSPAN_DEMO_FRESH to keep profiles between restarts." -ForegroundColor DarkYellow
  }
}

Write-Host "Starting KinSpan on http://127.0.0.1:$port (build from main.py BUILD_ID)"
Start-Process "http://127.0.0.1:$port/"
Start-Process "http://127.0.0.1:$port/v2/"
& .\.venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port $port --reload
