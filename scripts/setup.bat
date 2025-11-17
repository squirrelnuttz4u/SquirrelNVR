@echo off
REM SquirrelNVR Setup Script for Windows
REM This script installs and configures SquirrelNVR on Windows

echo ===============================================================
echo   SquirrelNVR Setup for Windows
echo ===============================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed
    echo Please install Node.js 18 or higher from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detected:
node -v

REM Check FFmpeg
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] FFmpeg is not installed
    echo Please install FFmpeg from https://ffmpeg.org/download.html
    echo and add it to your PATH
    pause
)

echo [OK] FFmpeg detected

REM Install dependencies
echo.
echo Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Building server...
call npm run build:server
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build server
    pause
    exit /b 1
)

echo.
echo Installing client dependencies...
cd client
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install client dependencies
    pause
    exit /b 1
)

echo.
echo Building client...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build client
    pause
    exit /b 1
)
cd ..

REM Create directories
echo.
echo Creating data directories...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "recordings" mkdir recordings
if not exist "recordings\hls" mkdir recordings\hls
if not exist "recordings\snapshots" mkdir recordings\snapshots
if not exist "recordings\thumbnails" mkdir recordings\thumbnails

REM Copy environment file
if not exist ".env" (
    echo.
    echo Creating .env file...
    copy .env.example .env
    echo [OK] .env file created
    echo [WARNING] Please edit .env file to configure your settings
)

echo.
echo ===============================================================
echo   SquirrelNVR Setup Complete!
echo ===============================================================
echo.
echo Next steps:
echo   1. Edit .env file to configure your settings
echo   2. Install as Windows service (optional):
echo      npm run install:service
echo   3. Or run directly:
echo      npm start
echo.
echo Default login:
echo   Username: admin
echo   Password: admin
echo.
echo [WARNING] Please change the default password after first login!
echo.
pause
