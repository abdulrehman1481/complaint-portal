# AHP Complaint Prioritization System - Dashboard Launcher (PowerShell)
# Right-click and select "Run with PowerShell" or double-click

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "   AHP COMPLAINT PRIORITIZATION SYSTEM - DASHBOARD LAUNCHER" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Starting dashboard..." -ForegroundColor Green
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Found Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dashboard.py exists
if (-not (Test-Path "dashboard.py")) {
    Write-Host "[ERROR] dashboard.py not found!" -ForegroundColor Red
    Write-Host "Please make sure you're running this from the correct directory." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Launch the dashboard
Write-Host "[OK] Launching dashboard GUI..." -ForegroundColor Green
Write-Host ""

try {
    python dashboard.py
} catch {
    Write-Host ""
    Write-Host "[ERROR] Dashboard encountered an error: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

exit 0
