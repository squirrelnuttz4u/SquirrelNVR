@echo off
setlocal enabledelayedexpansion

:: ========================================
:: SquirrelNVR - Automated Setup Script
:: ========================================
echo.
echo ========================================
echo  SquirrelNVR - Automated Setup
echo ========================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Running without administrator privileges.
    echo Some features may not work correctly.
    echo.
    timeout /t 3 >nul
)

:: ========================================
:: Step 1: Check Prerequisites
:: ========================================
echo [1/7] Checking prerequisites...
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 18 or higher from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm found: v%NPM_VERSION%

:: Check FFmpeg
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: FFmpeg is not installed or not in PATH!
    echo FFmpeg is REQUIRED for video processing.
    echo.
    echo Please install FFmpeg:
    echo   1. Download from: https://www.gyan.dev/ffmpeg/builds/
    echo   2. Extract to C:\ffmpeg
    echo   3. Add C:\ffmpeg\bin to your system PATH
    echo.
    set FFMPEG_MISSING=1
) else (
    for /f "tokens=3" %%i in ('ffmpeg -version ^| findstr "ffmpeg version"') do set FFMPEG_VERSION=%%i
    echo [OK] FFmpeg found: !FFMPEG_VERSION!
    set FFMPEG_MISSING=0
)

echo.

:: ========================================
:: Step 2: Detect GPU
:: ========================================
echo [2/7] Detecting GPU hardware...
echo.

set GPU_TYPE=none
set HARDWARE_ACCEL=none

:: Check for NVIDIA GPU
nvidia-smi >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] NVIDIA GPU detected
    for /f "tokens=*" %%i in ('nvidia-smi --query-gpu=name --format=csv,noheader') do (
        echo     GPU: %%i
    )
    set GPU_TYPE=nvidia
    set HARDWARE_ACCEL=cuda
    goto :gpu_detected
)

:: Check for Intel GPU (check for Intel graphics driver)
wmic path win32_VideoController get name | findstr /i "Intel" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Intel GPU detected
    for /f "tokens=*" %%i in ('wmic path win32_VideoController get name ^| findstr /i "Intel"') do (
        echo     GPU: %%i
    )
    set GPU_TYPE=intel
    set HARDWARE_ACCEL=qsv
    goto :gpu_detected
)

:: Check for AMD GPU
wmic path win32_VideoController get name | findstr /i "AMD\|Radeon" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] AMD GPU detected
    for /f "tokens=*" %%i in ('wmic path win32_VideoController get name ^| findstr /i "AMD Radeon"') do (
        echo     GPU: %%i
    )
    set GPU_TYPE=amd
    set HARDWARE_ACCEL=amf
    goto :gpu_detected
)

echo [WARNING] No supported GPU detected - using CPU only
set GPU_TYPE=none
set HARDWARE_ACCEL=none

:gpu_detected
echo.

:: ========================================
:: Step 3: Install Dependencies
:: ========================================
echo [3/7] Installing server dependencies...
echo.

if exist node_modules (
    echo Server dependencies already installed, skipping...
) else (
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install server dependencies!
        pause
        exit /b 1
    )
)

echo.
echo [4/7] Installing client dependencies...
echo.

if exist client\node_modules (
    echo Client dependencies already installed, skipping...
) else (
    cd client
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install client dependencies!
        pause
        exit /b 1
    )
    cd ..
)

echo.

:: ========================================
:: Step 5: Create .env file
:: ========================================
echo [5/7] Creating configuration file...
echo.

if exist .env (
    echo .env file already exists. Do you want to overwrite it?
    choice /c YN /n /m "Overwrite .env? (Y/N): "
    if errorlevel 2 (
        echo Keeping existing .env file...
        goto :skip_env
    )
)

:: Generate random secrets
set JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%
set SESSION_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%

echo Creating .env file with detected GPU settings...
(
echo # Server Configuration
echo NODE_ENV=production
echo PORT=3000
echo HOST=0.0.0.0
echo.
echo # Remote Viewer Configuration
echo REMOTE_VIEWER_PORT=8080
echo REMOTE_VIEWER_HTTPS_PORT=8443
echo ENABLE_HTTPS=false
echo.
echo # Database
echo DB_TYPE=sqlite
echo DB_PATH=./data/squirrel-nvr.db
echo.
echo # Storage
echo STORAGE_PATH=./recordings
echo MAX_STORAGE_GB=500
echo RETENTION_DAYS=30
echo.
echo # RTSP/RTMP Server
echo RTMP_PORT=1935
echo RTSP_PORT=8554
echo HTTP_STREAM_PORT=8000
echo.
echo # AI Services
echo CODEPROJECT_AI_URL=http://localhost:32168
echo FRIGATE_URL=http://localhost:5000
echo FRIGATE_MQTT_HOST=localhost
echo FRIGATE_MQTT_PORT=1883
echo.
echo # Email Notifications
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo SMTP_SECURE=false
echo SMTP_USER=your-email@gmail.com
echo SMTP_PASSWORD=your-app-password
echo SMTP_FROM=SquirrelNVR ^<your-email@gmail.com^>
echo.
echo # Security
echo JWT_SECRET=%JWT_SECRET%
echo SESSION_SECRET=%SESSION_SECRET%
echo.
echo # GPU Acceleration - AUTO DETECTED
echo GPU_TYPE=%GPU_TYPE%
echo HARDWARE_ACCEL=%HARDWARE_ACCEL%
echo.
echo # Features
echo ENABLE_MOTION_DETECTION=true
echo ENABLE_AI_DETECTION=true
echo ENABLE_LPR=true
echo ENABLE_AUDIO=true
echo.
echo # Performance
echo MAX_CONCURRENT_STREAMS=32
echo MOTION_DETECTION_FPS=5
echo AI_DETECTION_FPS=2
echo RECORDING_QUALITY=high
) > .env

echo [OK] Created .env file with GPU settings:
echo     GPU_TYPE=%GPU_TYPE%
echo     HARDWARE_ACCEL=%HARDWARE_ACCEL%

:skip_env
echo.

:: ========================================
:: Step 6: Build Project
:: ========================================
echo [6/7] Building TypeScript project...
echo.

echo Building server...
call npm run build:server
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Server build failed!
    pause
    exit /b 1
)

echo.
echo Building client...
call npm run build:client
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Client build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Build completed successfully!
echo.

:: ========================================
:: Step 7: Summary and Start
:: ========================================
echo [7/7] Setup complete!
echo.
echo ========================================
echo  Setup Summary
echo ========================================
echo.
echo Node.js:     %NODE_VERSION%
echo npm:         v%NPM_VERSION%
if %FFMPEG_MISSING% equ 0 (
    echo FFmpeg:      !FFMPEG_VERSION!
) else (
    echo FFmpeg:      NOT INSTALLED [REQUIRED]
)
echo GPU Type:    %GPU_TYPE%
echo HW Accel:    %HARDWARE_ACCEL%
echo.
echo Installation directory: %CD%
echo.

if %FFMPEG_MISSING% equ 1 (
    echo ========================================
    echo  WARNING: FFmpeg Not Installed
    echo ========================================
    echo.
    echo SquirrelNVR requires FFmpeg for video processing.
    echo The application may not work correctly without it.
    echo.
    echo Please install FFmpeg before starting the application:
    echo   1. Download: https://www.gyan.dev/ffmpeg/builds/
    echo   2. Extract to C:\ffmpeg
    echo   3. Add C:\ffmpeg\bin to your PATH
    echo   4. Restart this script
    echo.
    pause
    exit /b 0
)

echo ========================================
echo  Next Steps
echo ========================================
echo.
echo 1. Review and edit .env file if needed
echo 2. Start SquirrelNVR with: npm start
echo 3. Access the web interface at: http://localhost:3000
echo.
echo For development mode (auto-reload): npm run dev
echo.

choice /c YN /n /m "Do you want to start SquirrelNVR now? (Y/N): "
if errorlevel 2 (
    echo.
    echo Setup complete! Run 'npm start' when ready.
    pause
    exit /b 0
)

echo.
echo ========================================
echo  Starting SquirrelNVR...
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

call npm start

pause
