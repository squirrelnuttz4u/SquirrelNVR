@echo off
:: ========================================
:: SquirrelNVR - Quick Start Script
:: ========================================
:: Use this after initial setup is complete
:: For first-time setup, run: setup-and-run.bat
:: ========================================

echo.
echo Starting SquirrelNVR...
echo.

:: Check if built
if not exist dist\server\index.js (
    echo ERROR: Project not built yet!
    echo Please run: setup-and-run.bat
    echo.
    pause
    exit /b 1
)

:: Check if .env exists
if not exist .env (
    echo ERROR: Configuration file (.env) not found!
    echo Please run: setup-and-run.bat
    echo.
    pause
    exit /b 1
)

:: Display GPU info from .env
for /f "tokens=2 delims==" %%i in ('findstr "^GPU_TYPE=" .env') do set GPU_TYPE=%%i
for /f "tokens=2 delims==" %%i in ('findstr "^HARDWARE_ACCEL=" .env') do set HARDWARE_ACCEL=%%i

echo ========================================
echo  SquirrelNVR Configuration
echo ========================================
echo GPU Type:     %GPU_TYPE%
echo HW Accel:     %HARDWARE_ACCEL%
echo ========================================
echo.
echo Web Interface: http://localhost:3000
echo API Server:    http://localhost:3000/api
echo.
echo Press Ctrl+C to stop the server
echo.

npm start

pause
