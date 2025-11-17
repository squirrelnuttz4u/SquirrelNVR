@echo off
echo.
echo ========================================
echo  SquirrelNVR - Setup Status Check
echo ========================================
echo.

echo Checking setup status...
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js: %%i
) else (
    echo [MISSING] Node.js - REQUIRED
)

:: Check FFmpeg
ffmpeg -version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=3" %%i in ('ffmpeg -version ^| findstr "ffmpeg version"') do echo [OK] FFmpeg: %%i
) else (
    echo [MISSING] FFmpeg - REQUIRED
)

:: Check dependencies
if exist node_modules (
    echo [OK] Server dependencies installed
) else (
    echo [MISSING] Server dependencies - Run: npm install
)

if exist client\node_modules (
    echo [OK] Client dependencies installed
) else (
    echo [MISSING] Client dependencies - Run: cd client ^&^& npm install
)

:: Check .env
if exist .env (
    echo [OK] Configuration file (.env) exists
) else (
    echo [MISSING] Configuration file - Run: copy .env.example .env
)

:: Check build
if exist dist\server\index.js (
    echo [OK] Project is built
) else (
    echo [MISSING] Project not built - Run: npm run build
)

echo.
echo ========================================
echo.

if not exist node_modules (
    echo NEXT STEP: Run setup-and-run.bat and let it complete
    echo            DO NOT interrupt the script!
) else if not exist dist\server\index.js (
    echo NEXT STEP: Run: npm run build
) else (
    echo STATUS: Ready to start!
    echo RUN: start.bat
)

echo.
pause
