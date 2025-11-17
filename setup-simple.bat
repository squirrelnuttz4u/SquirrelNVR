@echo off
echo.
echo ========================================
echo  SquirrelNVR - Setup Debug
echo ========================================
echo.

echo Testing each step...
echo.

echo [Step 1] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo FAILED: Node.js not found
    pause
    exit /b 1
)
echo SUCCESS
echo.

echo [Step 2] Checking npm...
npm --version
if %errorlevel% neq 0 (
    echo FAILED: npm not found
    pause
    exit /b 1
)
echo SUCCESS
echo.

echo [Step 3] Checking FFmpeg...
ffmpeg -version 2>nul | findstr "ffmpeg version"
if %errorlevel% neq 0 (
    echo FAILED: FFmpeg not found in PATH
    echo This is OK - we can continue without it for now
    echo You can install FFmpeg later
    set HAS_FFMPEG=0
) else (
    echo SUCCESS
    set HAS_FFMPEG=1
)
echo.

echo [Step 4] Checking current directory...
echo Current directory: %CD%
dir package.json >nul 2>&1
if %errorlevel% neq 0 (
    echo FAILED: package.json not found
    echo Are you in the correct directory?
    pause
    exit /b 1
)
echo SUCCESS - Found package.json
echo.

echo ========================================
echo All checks passed!
echo ========================================
echo.

if %HAS_FFMPEG% equ 0 (
    echo WARNING: FFmpeg is not installed
    echo The application may not work without it
    echo.
)

echo Ready to install dependencies.
echo This will download about 200MB and take 2-5 minutes.
echo.
choice /c YN /m "Continue with installation? (Y/N)"
if errorlevel 2 (
    echo Installation cancelled
    pause
    exit /b 0
)

echo.
echo Installing server dependencies...
call npm install
if %errorlevel% neq 0 (
    echo FAILED: npm install failed
    pause
    exit /b 1
)

echo.
echo Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo FAILED: client npm install failed
    pause
    exit /b 1
)
cd ..

echo.
echo Creating .env configuration...
if exist .env (
    echo .env already exists - keeping it
) else (
    copy .env.example .env
    echo Created .env file - you may want to edit it
)

echo.
echo Building project...
call npm run build
if %errorlevel% neq 0 (
    echo FAILED: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  SUCCESS! Setup Complete!
echo ========================================
echo.
echo Run: start.bat
echo Or:  npm start
echo.
pause
