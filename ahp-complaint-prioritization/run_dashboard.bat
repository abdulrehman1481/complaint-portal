@echo off
REM AHP Complaint Prioritization System - Dashboard Launcher
REM Double-click this file to start the dashboard

cls
echo ================================================================================
echo    AHP COMPLAINT PRIORITIZATION SYSTEM - DASHBOARD LAUNCHER
echo ================================================================================
echo.
echo Starting dashboard...
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

REM Check if dashboard.py exists
if not exist "dashboard.py" (
    echo [ERROR] dashboard.py not found!
    echo Please make sure you're running this from the correct directory.
    echo.
    pause
    exit /b 1
)

REM Launch the dashboard
echo [OK] Launching dashboard GUI...
echo.
python dashboard.py

REM If dashboard closes with error
if errorlevel 1 (
    echo.
    echo [ERROR] Dashboard encountered an error.
    echo.
    pause
)

exit /b 0
