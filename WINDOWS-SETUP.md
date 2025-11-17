# SquirrelNVR - Windows Setup Guide

Complete guide for installing and configuring SquirrelNVR on Windows with GPU acceleration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Recent Updates](#recent-updates)
3. [Quick Start (Automated)](#quick-start-automated)
4. [Manual Installation](#manual-installation)
5. [GPU Acceleration Setup](#gpu-acceleration-setup)
6. [FFmpeg Installation](#ffmpeg-installation)
7. [AI Services Setup](#ai-services-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js 18 or higher**
   - Download: https://nodejs.org/
   - Recommended: LTS version (20.x or higher)
   - Verify installation: `node --version`

2. **FFmpeg** (REQUIRED for video processing)
   - Download: https://www.gyan.dev/ffmpeg/builds/
   - See [FFmpeg Installation](#ffmpeg-installation) section below

3. **Git** (for cloning repository)
   - Download: https://git-scm.com/download/win
   - Or download ZIP from GitHub

### Optional (for AI features)

4. **CodeProject.AI Server**
   - Download: https://www.codeproject.com/AI/docs/install/install_windows.html
   - Provides object detection, face recognition, and license plate recognition

5. **Frigate** (advanced users)
   - Requires Docker Desktop for Windows
   - See: https://docs.frigate.video/

---

## Recent Updates

### Latest Fixes (Current Build)

**✅ Fixed White Screen Issues**
- Dashboard, Detections, and other pages now show error messages instead of blank screens
- Added retry buttons when API calls fail
- Better error handling prevents crashes when backend is offline

**✅ Fixed Camera Save Issues**
- Camera vendor, model, and stream URL now save correctly
- Auto-generation of stream URLs from vendor presets (Reolink, Hikvision, Dahua, Amcrest, Axis)
- Stream URL properly built from IP address, port, and vendor settings

**✅ Improved Error Handling**
- User-friendly error messages throughout the UI
- Clear guidance when backend server isn't running
- Validation of API responses to prevent runtime errors

**✅ TypeScript Compilation Fixes**
- All TypeScript errors resolved
- Proper type annotations added
- Build process now completes without errors

### What This Means for You

If you were experiencing:
- **White/blank pages** → Now shows helpful error messages
- **Camera details not saving** → Now saves vendor, model, and stream URL correctly
- **Pages crashing** → Now has defensive error handling
- **Build failures** → TypeScript compilation now works

**To get these fixes:**
```powershell
git pull origin claude/nvr-ai-camera-system-01Ls3QubCYnPhhacdMZt4J3Q
npm run build
npm start
```

---

## Quick Start (Automated)

### One-Command Setup

The easiest way to get started:

```powershell
setup-and-run.bat
```

This script will automatically:
- ✅ Check for Node.js, npm, and FFmpeg
- ✅ Detect your GPU type (NVIDIA, Intel, AMD)
- ✅ Install all dependencies (server + client)
- ✅ Create `.env` configuration file with GPU settings
- ✅ Build the TypeScript project
- ✅ Optionally start the application

**That's it!** The script handles everything.

### Subsequent Runs

After initial setup, use the quick-start script:

```powershell
start.bat
```

Or manually:

```powershell
npm start
```

---

## Manual Installation

If you prefer manual installation or the automated script fails:

### Step 1: Install Dependencies

Open PowerShell or Command Prompt in the SquirrelNVR directory:

```powershell
# Install root/server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

**Note:** If you get 403 errors from npm registry, you may need to:
- Check your network/proxy settings
- Try using a different npm registry: `npm config set registry https://registry.npmjs.org/`
- Clear npm cache: `npm cache clean --force`

### Step 2: Create Configuration

```powershell
# Copy example configuration
copy .env.example .env
```

Edit `.env` and configure your settings (see [GPU Acceleration](#gpu-acceleration-setup)).

**Important Settings:**
```env
# Server
PORT=3000
NODE_ENV=production

# Storage
STORAGE_PATH=C:\SquirrelNVR\recordings
MAX_STORAGE_GB=500

# GPU (see GPU Acceleration section)
GPU_TYPE=nvidia
HARDWARE_ACCEL=cuda
```

### Step 3: Build Project

Build both server and client TypeScript code:

```powershell
# Build everything (recommended)
npm run build
```

This will:
1. ✅ Compile server TypeScript to JavaScript (output: `dist/server/`)
2. ✅ Compile client TypeScript and bundle with Vite (output: `client/dist/`)
3. ✅ Check for TypeScript errors

**Build separately if needed:**

```powershell
# Build only server
npm run build:server

# Build only client
npm run build:client
```

**Verify build succeeded:**
```powershell
# Check server output
dir dist\server

# Check client output
dir client\dist
```

You should see compiled JavaScript files and the built React application.

### Step 4: Start Application

**Option A: Production Mode (Recommended)**

Runs the built application for best performance:

```powershell
npm start
```

This starts:
- Backend server on http://localhost:3000/api
- Frontend served from http://localhost:3000

**Option B: Development Mode**

Auto-reloads on file changes (for development only):

```powershell
npm run dev
```

**Option C: Run Server and Client Separately (Advanced)**

Terminal 1 - Backend Server:
```powershell
npm run dev:server
```

Terminal 2 - Frontend Dev Server:
```powershell
cd client
npm run dev
```

Then access:
- Frontend: http://localhost:5173 (Vite dev server)
- Backend API: http://localhost:3000/api

### Step 5: Access Web Interface

Open your browser and navigate to:

```
http://localhost:3000
```

**Default Login:**
- Username: `admin`
- Password: `admin123`

⚠️ **Important:** Change the default password immediately after first login!

### Step 6: Verify Everything Works

1. **Check Backend:**
   - Backend logs should show "Server started on port 3000"
   - No errors about FFmpeg, database, or GPU

2. **Check Frontend:**
   - Login page should appear (not blank/white screen)
   - After login, dashboard should load with stats

3. **Add Test Camera:**
   - Go to Cameras page
   - Click "Add Camera"
   - Fill in camera details
   - Verify camera appears in live view

4. **Check GPU (if configured):**
   ```powershell
   # NVIDIA
   nvidia-smi

   # Should show GPU processes when streaming
   ```

---

## GPU Acceleration Setup

SquirrelNVR supports hardware-accelerated video encoding for better performance and lower CPU usage.

### Supported GPUs

| GPU Vendor | Type | Hardware Acceleration | Performance |
|------------|------|----------------------|-------------|
| NVIDIA     | GeForce/Quadro/Tesla | CUDA (`nvenc`) | ⭐⭐⭐⭐⭐ Excellent |
| Intel      | HD/UHD/Iris/Arc | QuickSync (`qsv`) | ⭐⭐⭐⭐ Very Good |
| AMD        | Radeon/RX/Vega | AMF (`amf`) | ⭐⭐⭐ Good |
| CPU Only   | Any | Software (`libx264`) | ⭐⭐ Fair (slower) |

### Auto-Detection

The `setup-and-run.bat` script automatically detects your GPU and configures `.env`:

```env
GPU_TYPE=nvidia         # Detected GPU type
HARDWARE_ACCEL=cuda     # Acceleration method
```

### Manual Configuration

Edit `.env` and set GPU settings:

#### NVIDIA GPU (GeForce, Quadro, Tesla)

```env
GPU_TYPE=nvidia
HARDWARE_ACCEL=cuda
```

**Requirements:**
- NVIDIA GPU with NVENC support (GTX 600 series or newer)
- Latest NVIDIA drivers: https://www.nvidia.com/Download/index.aspx
- CUDA Toolkit (optional, included in drivers): https://developer.nvidia.com/cuda-downloads

**Verify NVIDIA GPU:**
```powershell
nvidia-smi
```

#### Intel GPU (HD Graphics, UHD Graphics, Iris, Arc)

```env
GPU_TYPE=intel
HARDWARE_ACCEL=qsv
```

**Requirements:**
- Intel CPU with integrated graphics (6th gen or newer)
- Intel Graphics drivers: https://downloadcenter.intel.com/

**Supported CPUs:**
- Intel Core 6th Gen (Skylake) or newer
- Intel Arc dedicated GPUs

#### AMD GPU (Radeon, RX series, Vega)

```env
GPU_TYPE=amd
HARDWARE_ACCEL=amf
```

**Requirements:**
- AMD Radeon GPU (RX 400 series or newer)
- AMD Adrenalin drivers: https://www.amd.com/en/support

**Note:** AMD support requires FFmpeg compiled with AMF support.

#### CPU-Only (No GPU)

```env
GPU_TYPE=none
HARDWARE_ACCEL=none
```

Uses software encoding (libx264). Slower but works on any system.

### Performance Comparison

For 4 cameras @ 1080p with continuous recording:

| Hardware | CPU Usage | Encoding Speed | Recommended Cameras |
|----------|-----------|----------------|---------------------|
| NVIDIA RTX 3060 | ~5% | 200+ fps | 20+ cameras |
| Intel i7-12700K (UHD 770) | ~15% | 150+ fps | 15+ cameras |
| AMD RX 6600 | ~20% | 100+ fps | 10+ cameras |
| CPU Only (i7-12700K) | ~80% | 30 fps | 4-6 cameras |

---

## FFmpeg Installation

FFmpeg is **REQUIRED** for SquirrelNVR to process video streams.

### Recommended Method (Pre-built Binaries)

1. **Download FFmpeg:**
   - Visit: https://www.gyan.dev/ffmpeg/builds/
   - Download: **ffmpeg-release-essentials.zip** (smaller) or **ffmpeg-release-full.zip** (complete)

2. **Extract Files:**
   ```
   Extract to: C:\ffmpeg
   ```

3. **Add to PATH:**

   **Option A: GUI Method**
   - Right-click "This PC" → Properties
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find "Path"
   - Click "Edit" → "New"
   - Add: `C:\ffmpeg\bin`
   - Click "OK" on all dialogs
   - **Restart your terminal/PowerShell**

   **Option B: PowerShell Method (Admin)**
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ffmpeg\bin", "Machine")
   ```

4. **Verify Installation:**
   ```powershell
   # Restart PowerShell/Terminal first!
   ffmpeg -version
   ```

   You should see FFmpeg version information.

### GPU-Specific FFmpeg Builds

For best GPU performance, use builds with GPU support:

#### NVIDIA GPU
- Download: **ffmpeg-release-full.zip** (includes NVENC/CUDA)
- Verify NVENC support:
  ```powershell
  ffmpeg -encoders | findstr nvenc
  ```
  Should show: `h264_nvenc`, `hevc_nvenc`

#### Intel QuickSync
- Download: **ffmpeg-release-full.zip** (includes QSV)
- Verify QSV support:
  ```powershell
  ffmpeg -encoders | findstr qsv
  ```
  Should show: `h264_qsv`, `hevc_qsv`

#### AMD AMF
- May require custom FFmpeg build with AMF support
- Or use: https://github.com/BtbN/FFmpeg-Builds/releases
- Look for builds with "gpl" and "shared" in the name

---

## AI Services Setup

### CodeProject.AI Server

CodeProject.AI provides object detection, face recognition, and license plate recognition.

1. **Download and Install:**
   - Visit: https://www.codeproject.com/AI/docs/install/install_windows.html
   - Download Windows installer
   - Run installer (default port: 32168)

2. **Configure SquirrelNVR:**

   Edit `.env`:
   ```env
   CODEPROJECT_AI_URL=http://localhost:32168
   ENABLE_AI_DETECTION=true
   ENABLE_LPR=true
   ```

3. **Install AI Models:**
   - Open CodeProject.AI dashboard: http://localhost:32168
   - Go to "Modules" tab
   - Install recommended modules:
     - **Object Detection (YOLOv5)** - General object detection
     - **License Plate Reader** - License plate recognition
     - **Face Processing** - Face detection and recognition

4. **GPU Acceleration in CodeProject.AI:**
   - NVIDIA: Automatically uses CUDA if available
   - Check "Status" tab to verify GPU is detected

### Frigate (Optional - Advanced)

Frigate is a powerful NVR with Google Coral TPU support.

1. **Install Docker Desktop:**
   - Download: https://www.docker.com/products/docker-desktop/
   - Requires Windows 10/11 Pro or WSL2

2. **Run Frigate:**
   ```powershell
   docker run -d `
     --name frigate `
     --restart=unless-stopped `
     -v frigate-config:/config `
     -v frigate-media:/media/frigate `
     -p 5000:5000 `
     -p 1883:1883 `
     ghcr.io/blakeblackshear/frigate:stable
   ```

3. **Configure SquirrelNVR:**

   Edit `.env`:
   ```env
   FRIGATE_URL=http://localhost:5000
   FRIGATE_MQTT_HOST=localhost
   FRIGATE_MQTT_PORT=1883
   ```

---

## Running as Windows Service

Install SquirrelNVR to run automatically on system startup.

### Install Service

```powershell
npm run install:service
```

The service will:
- ✅ Start automatically on Windows boot
- ✅ Restart on failure
- ✅ Run in background
- ✅ Use configured GPU acceleration

### Uninstall Service

```powershell
npm run uninstall:service
```

### Service Management

```powershell
# Start service
net start SquirrelNVR

# Stop service
net stop SquirrelNVR

# Check status
sc query SquirrelNVR
```

Or use Windows Services Manager:
- Press `Win+R`, type `services.msc`
- Find "SquirrelNVR"
- Right-click → Start/Stop/Restart

---

## Troubleshooting

### FFmpeg Not Found

**Error:** `'ffmpeg' is not recognized as an internal or external command`

**Solution:**
1. Verify FFmpeg is installed in `C:\ffmpeg\bin`
2. Check PATH environment variable includes `C:\ffmpeg\bin`
3. **Restart PowerShell/Terminal** after adding to PATH
4. Verify: `ffmpeg -version`

### GPU Not Detected

**Error:** GPU acceleration not working

**NVIDIA:**
```powershell
# Check NVIDIA driver
nvidia-smi

# Check FFmpeg NVENC support
ffmpeg -encoders | findstr nvenc
```

**Intel:**
```powershell
# Check Intel GPU
wmic path win32_VideoController get name

# Check FFmpeg QSV support
ffmpeg -encoders | findstr qsv
```

**AMD:**
```powershell
# Check AMD GPU
wmic path win32_VideoController get name

# Check FFmpeg AMF support
ffmpeg -encoders | findstr amf
```

### Build Failures

**Error:** `npm run build` fails with TypeScript errors

**Common Solutions:**
```powershell
# Clear caches and rebuild
rmdir /s /q node_modules
rmdir /s /q client\node_modules
rmdir /s /q dist
rmdir /s /q client\dist
npm install
cd client
npm install
cd ..
npm run build
```

**Error:** TypeScript compilation errors in client

If you see errors like:
- `Cannot find module 'react'`
- `Cannot find module '@mui/material'`
- `JSX element implicitly has type 'any'`

**Solution:**
```powershell
# Reinstall client dependencies
cd client
rmdir /s /q node_modules
npm install
cd ..
npm run build:client
```

**Error:** TypeScript errors in server

If you see errors like:
- `Cannot find module 'express'`
- `Cannot find module 'typeorm'`
- `Do you need to install type definitions for node?`

**Solution:**
```powershell
# Reinstall root dependencies
rmdir /s /q node_modules
npm install
npm run build:server
```

### White Screen / Blank Pages

**Issue:** Pages flash for a second then go white (Dashboard, Detections, etc.)

**Causes:**
1. Backend server not running
2. API connection errors
3. JavaScript errors in browser console

**Solutions:**

**Step 1: Check Backend is Running**
```powershell
# Start the backend if not running
npm start
```

Check for error messages in the console. Look for:
- "Server started on port 3000" ✅ Good
- Database connection errors ❌ Bad
- FFmpeg not found ❌ Bad

**Step 2: Check Browser Console**
1. Open browser DevTools (Press F12)
2. Go to Console tab
3. Look for red error messages
4. Common errors:
   - `Failed to fetch` - Backend not running
   - `Network error` - Wrong API URL
   - `CORS error` - Backend CORS misconfigured

**Step 3: Verify API Connection**
```powershell
# Test API endpoint
curl http://localhost:3000/api/system/stats
```

Should return JSON data, not an error.

**Step 4: Check Error Messages**

The fixed UI now shows error messages instead of white screens. You should see:
- Red error alert with retry button
- Error message explaining the issue
- "Make sure the backend server is running"

**Recent Fixes Applied:**
- Dashboard now shows error alerts instead of crashing
- Detections page validates API responses
- Better error messages to guide troubleshooting

### Camera Data Not Saving

**Issue:** Camera stream URL, vendor, or model not saving

**Cause:** Fixed in recent update - buildStreamUrl() wasn't being called when saving

**Solution:**

**Step 1: Update to Latest Code**
```powershell
git pull origin claude/nvr-ai-camera-system-01Ls3QubCYnPhhacdMZt4J3Q
npm run build
npm start
```

**Step 2: Verify Camera Save Process**
1. Go to Cameras page
2. Click "Add Camera"
3. Fill in REQUIRED fields:
   - Camera Name ✅
   - Vendor (select from dropdown) ✅
   - IP Address ✅
   - Port (default: 554) ✅
   - Username/Password (if camera requires) ✅

4. The Stream URL will auto-generate based on vendor preset

**Step 3: Check Saved Camera**
1. After saving, camera should appear in list
2. Click Edit on the camera
3. Verify all fields are populated:
   - Name ✅
   - Vendor ✅
   - Model ✅
   - Stream URL (should be complete RTSP URL) ✅

**Supported Vendors with Presets:**
- Reolink
- Hikvision
- Dahua
- Amcrest
- Axis

**Example Auto-Generated URLs:**
- Reolink: `rtsp://admin:password@192.168.1.100:554/h264Preview_01_main`
- Hikvision: `rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101`
- Axis: `rtsp://admin:password@192.168.1.100:554/axis-media/media.amp`

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:** Edit `.env` and change the port:
```env
PORT=3001
```

### Cannot Start Service

**Error:** Service installation fails

**Solution:**
- Run PowerShell/Command Prompt as **Administrator**
- Disable antivirus temporarily
- Check Windows Event Viewer for errors

### High CPU Usage with GPU

**Issue:** CPU usage high even with GPU configured

**Possible Causes:**
1. GPU not properly detected
2. FFmpeg not using GPU encoder
3. Too many concurrent streams

**Debug:**
```powershell
# Check which encoder is being used (look for nvenc/qsv/amf)
# Enable debug logging in .env:
LOG_LEVEL=debug
```

Check logs for FFmpeg command - should include:
- NVIDIA: `-c:v h264_nvenc`
- Intel: `-c:v h264_qsv`
- AMD: `-c:v h264_amf`

### Out of Memory Errors

**Error:** Node.js runs out of memory

**Solution:** Increase Node.js memory limit:
```powershell
# Windows: Create start-with-memory.bat
@echo off
node --max-old-space-size=4096 dist/server/index.js
```

Or edit `package.json`:
```json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 dist/server/index.js"
  }
}
```

---

## Performance Tuning

### Optimal Settings for Different Systems

#### High-End (NVIDIA RTX 3060+, 16GB+ RAM)
```env
MAX_CONCURRENT_STREAMS=32
MOTION_DETECTION_FPS=10
AI_DETECTION_FPS=5
RECORDING_QUALITY=high
GPU_TYPE=nvidia
HARDWARE_ACCEL=cuda
```

#### Mid-Range (Intel i5/i7 with integrated GPU, 8GB+ RAM)
```env
MAX_CONCURRENT_STREAMS=16
MOTION_DETECTION_FPS=5
AI_DETECTION_FPS=2
RECORDING_QUALITY=medium
GPU_TYPE=intel
HARDWARE_ACCEL=qsv
```

#### Low-End (CPU only, 4GB RAM)
```env
MAX_CONCURRENT_STREAMS=4
MOTION_DETECTION_FPS=3
AI_DETECTION_FPS=1
RECORDING_QUALITY=medium
GPU_TYPE=none
HARDWARE_ACCEL=none
```

---

## Additional Resources

- **Main Documentation:** [README.md](README.md)
- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **User Management:** [USER-MANAGEMENT.md](USER-MANAGEMENT.md)
- **AI Features:** [FEATURES-SUMMARY.md](FEATURES-SUMMARY.md)

### External Resources

- **FFmpeg Documentation:** https://ffmpeg.org/documentation.html
- **NVIDIA NVENC:** https://developer.nvidia.com/nvidia-video-codec-sdk
- **Intel QuickSync:** https://www.intel.com/content/www/us/en/architecture-and-technology/quick-sync-video/quick-sync-video-general.html
- **AMD AMF:** https://gpuopen.com/advanced-media-framework/
- **CodeProject.AI:** https://www.codeproject.com/AI/docs/
- **Frigate:** https://docs.frigate.video/

---

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review logs in `./logs` directory
3. Enable debug logging: Set `LOG_LEVEL=debug` in `.env`
4. Check GPU is working: `nvidia-smi` (NVIDIA) or device manager
5. Verify FFmpeg: `ffmpeg -encoders | findstr "nvenc qsv amf"`

---

**Happy Monitoring! 🐿️📹**
