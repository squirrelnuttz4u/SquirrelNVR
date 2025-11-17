@echo off
:: ========================================
:: FFmpeg Installation Script for Windows
:: ========================================
:: This script helps install FFmpeg to C:\ffmpeg
:: and adds it to the system PATH
:: ========================================

echo.
echo ========================================
echo  FFmpeg Installation Helper
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Not running as Administrator
    echo You may not be able to modify system PATH
    echo.
    echo Please right-click this script and select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

:: Check if FFmpeg already exists
if exist "C:\ffmpeg\bin\ffmpeg.exe" (
    echo FFmpeg is already installed at C:\ffmpeg
    echo.
    goto :check_path
)

echo FFmpeg is not installed at C:\ffmpeg
echo.
echo ========================================
echo  Installation Options
echo ========================================
echo.
echo 1. I will download and extract FFmpeg manually
echo 2. Show me the download link
echo.

choice /c 12 /n /m "Select option (1 or 2): "
set CHOICE=%errorlevel%

if %CHOICE% equ 2 (
    echo.
    echo ========================================
    echo  Download FFmpeg
    echo ========================================
    echo.
    echo 1. Open this URL in your browser:
    echo    https://www.gyan.dev/ffmpeg/builds/
    echo.
    echo 2. Download: ffmpeg-release-full.zip
    echo    ^(The "full" version includes GPU support^)
    echo.
    echo 3. Extract the ZIP file
    echo.
    echo 4. Rename the extracted folder to "ffmpeg"
    echo.
    echo 5. Move it to C:\ffmpeg
    echo    Final path should be: C:\ffmpeg\bin\ffmpeg.exe
    echo.
    echo 6. Run this script again to add it to PATH
    echo.
    pause
    exit /b 0
)

echo.
echo Please download and extract FFmpeg to C:\ffmpeg
echo Then run this script again.
echo.
pause
exit /b 0

:check_path
echo.
echo Checking if FFmpeg is in PATH...

:: Test if ffmpeg is accessible
ffmpeg -version >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo [OK] FFmpeg is already in PATH and working!
    echo.
    ffmpeg -version | findstr "ffmpeg version"
    echo.

    :: Check for GPU encoder support
    echo.
    echo Checking GPU encoder support...
    echo.

    ffmpeg -encoders 2>nul | findstr "nvenc" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] NVIDIA NVENC support detected
    ) else (
        echo [--] NVIDIA NVENC not available
    )

    ffmpeg -encoders 2>nul | findstr "qsv" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Intel QuickSync support detected
    ) else (
        echo [--] Intel QuickSync not available
    )

    ffmpeg -encoders 2>nul | findstr "amf" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] AMD AMF support detected
    ) else (
        echo [--] AMD AMF not available
    )

    echo.
    echo All done! You're ready to use SquirrelNVR.
    echo.
    pause
    exit /b 0
)

echo.
echo FFmpeg is installed but not in PATH.
echo.
choice /c YN /n /m "Add C:\ffmpeg\bin to system PATH? (Y/N): "
if errorlevel 2 (
    echo.
    echo Cancelled. You can add it manually:
    echo 1. Open System Properties ^> Environment Variables
    echo 2. Edit System PATH
    echo 3. Add: C:\ffmpeg\bin
    echo.
    pause
    exit /b 0
)

echo.
echo Adding C:\ffmpeg\bin to system PATH...

:: Get current PATH
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set CURRENT_PATH=%%b

:: Check if already in PATH
echo %CURRENT_PATH% | findstr /i /c:"C:\ffmpeg\bin" >nul
if %errorlevel% equ 0 (
    echo C:\ffmpeg\bin is already in PATH
    goto :path_set
)

:: Add to PATH
set NEW_PATH=%CURRENT_PATH%;C:\ffmpeg\bin

:: Update registry
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path /t REG_EXPAND_SZ /d "%NEW_PATH%" /f >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to update PATH
    echo Please add it manually or run as Administrator
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Successfully added to PATH!

:path_set
echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo IMPORTANT: You MUST restart your terminal/PowerShell
echo for the PATH changes to take effect.
echo.
echo After restarting, verify with:
echo   ffmpeg -version
echo.
echo Then run: setup-simple.bat
echo.
pause
