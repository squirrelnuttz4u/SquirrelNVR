# SquirrelNVR - Windows Setup Guide

Complete guide for installing and configuring SquirrelNVR on Windows with GPU acceleration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Automated)](#quick-start-automated)
3. [Manual Installation](#manual-installation)
4. [GPU Acceleration Setup](#gpu-acceleration-setup)
5. [FFmpeg Installation](#ffmpeg-installation)
6. [AI Services Setup](#ai-services-setup)
7. [Troubleshooting](#troubleshooting)

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

```powershell
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### Step 2: Create Configuration

```powershell
# Copy example configuration
copy .env.example .env
```

Edit `.env` and configure your settings (see [GPU Acceleration](#gpu-acceleration-setup)).

### Step 3: Build Project

```powershell
# Build server and client
npm run build
```

Or build separately:

```powershell
# Build only server
npm run build:server

# Build only client
npm run build:client
```

### Step 4: Start Application

```powershell
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```

Access the web interface at: http://localhost:3000

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

**Error:** `npm run build` fails

**Common Solutions:**
```powershell
# Clear caches and rebuild
rmdir /s /q node_modules
rmdir /s /q client\node_modules
rmdir /s /q dist
npm install
cd client
npm install
cd ..
npm run build
```

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
