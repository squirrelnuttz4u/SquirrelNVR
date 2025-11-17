# Camera Setup Guide - Getting Your First Camera Connected

Complete step-by-step guide for connecting IP cameras to SquirrelNVR.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Finding Your Camera Information](#finding-your-camera-information)
3. [Adding a Camera - Step by Step](#adding-a-camera---step-by-step)
4. [Supported Camera Brands](#supported-camera-brands)
5. [Testing Camera Connection](#testing-camera-connection)
6. [Troubleshooting](#troubleshooting)
7. [Common Camera Settings](#common-camera-settings)

---

## Prerequisites

Before adding a camera, ensure:

1. ✅ **SquirrelNVR backend is running**
   ```powershell
   npm start
   ```
   Check console shows: "Server started on port 3000"

2. ✅ **Camera is on the same network**
   - Camera and SquirrelNVR server must be able to communicate
   - Test with ping: `ping 192.168.1.100` (replace with your camera IP)

3. ✅ **You know your camera's:**
   - IP address
   - Username
   - Password
   - Brand/Model
   - RTSP port (usually 554)

---

## Finding Your Camera Information

### Method 1: Camera Manufacturer's Software

Most IP camera brands provide software to discover cameras on your network:

- **Reolink**: Reolink Client
- **Hikvision**: SADP Tool or iVMS-4200
- **Dahua**: Config Tool
- **Amcrest**: Amcrest IP Config
- **Axis**: AXIS IP Utility

### Method 2: Check Your Router

1. Log into your router's admin panel (usually http://192.168.1.1)
2. Look for "DHCP Client List" or "Connected Devices"
3. Find device with camera brand name
4. Note the IP address

### Method 3: Use Network Scanner

```powershell
# Windows - Using Advanced IP Scanner (free download)
# Or use nmap if installed
nmap -sn 192.168.1.0/24
```

### Method 4: Check Camera Label

Most cameras have a sticker with:
- Default IP address (like 192.168.1.108)
- Default username/password (often admin/admin)
- Model number

---

## Adding a Camera - Step by Step

### Step 1: Open SquirrelNVR Web Interface

1. Open browser and go to: http://localhost:3000
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. Click on **"Cameras"** in the sidebar

### Step 2: Click "Add Camera"

Click the **"+ Add Camera"** button in the top right.

### Step 3: Fill in Basic Information

In the dialog that opens:

#### Tab 1: Basic

**Camera Name** (Required)
```
Front Door Camera
```
Give it a descriptive name like "Front Door", "Backyard", "Driveway", etc.

**Vendor** (Recommended - use dropdown)
Select your camera brand from the dropdown:
- Reolink
- Hikvision
- Dahua
- Amcrest
- Axis
- Custom/Other (if your brand isn't listed)

**Model** (Optional)
```
RLC-410
```
Enter your camera model number (helps for reference).

**IP Address** (Required if using vendor preset)
```
192.168.1.100
```
Enter your camera's IP address.

**Port** (Required)
```
554
```
Default RTSP port is 554. Only change if your camera uses a different port.

### Step 4: Fill in Stream Information

#### Tab 2: Stream

**Stream Type**
- **RTSP** (Most common - select this for most IP cameras)
- RTMP
- HLS
- MJPEG
- ONVIF

**Stream URL** (Auto-generated for vendor cameras)

If you selected a vendor and entered IP address, this will auto-generate.

For **custom cameras**, enter the complete RTSP URL manually:
```
rtsp://admin:password@192.168.1.100:554/stream1
```

Format: `rtsp://username:password@camera-ip:port/path`

**Username** (Required for most cameras)
```
admin
```
The username for your camera (common defaults: admin, root)

**Password** (Required)
```
YourCameraPassword
```
The password for your camera

### Step 5: Configure Recording

#### Tab 3: Recording

**Enable Camera**
- ✅ Check this box to enable the camera

**Recording Mode**
- **Continuous** - Records 24/7 (recommended for testing)
- **Motion** - Only records on motion detection
- **Scheduled** - Records on a schedule
- **Motion + Scheduled** - Records on motion during scheduled times

**Recording Quality**
- **Ultra** - Highest quality (large file size)
- **High** - High quality (recommended)
- **Medium** - Medium quality (balanced)
- **Low** - Lower quality (small file size)

**Recording FPS**
- **30** - Smooth (default)
- **15** - Balanced
- **10** - Low bandwidth

### Step 6: Save Camera

1. Click **"Add Camera"** button at bottom
2. Camera should appear in the camera list
3. Wait 5-10 seconds for connection attempt

### Step 7: Verify Camera is Working

1. Check camera status in list:
   - **Green "Online"** ✅ - Camera connected successfully!
   - **Red "Offline"** ❌ - Connection failed (see troubleshooting)

2. Click on **"Live View"** in sidebar
3. Your camera should appear with live video feed

---

## Supported Camera Brands

### Reolink Cameras

**Example Models**: RLC-410, RLC-520, RLC-810A, RLC-811A

**Auto-Configuration:**
- Vendor: `Reolink`
- IP Address: `192.168.1.100` (your camera's IP)
- Port: `554`
- Username: `admin` (or your camera username)
- Password: `your_password`

**Generated Stream URL:**
```
rtsp://admin:password@192.168.1.100:554/h264Preview_01_main
```

**Manual RTSP Paths** (if custom setup):
- Main Stream: `/h264Preview_01_main`
- Sub Stream: `/h264Preview_01_sub`

### Hikvision Cameras

**Example Models**: DS-2CD2xx series, DS-2CD3xx series

**Auto-Configuration:**
- Vendor: `Hikvision`
- IP Address: `192.168.1.100`
- Port: `554`
- Username: `admin`
- Password: `your_password`

**Generated Stream URL:**
```
rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101
```

**Manual RTSP Paths:**
- Channel 1 Main Stream: `/Streaming/Channels/101`
- Channel 1 Sub Stream: `/Streaming/Channels/102`
- Channel 2 Main Stream: `/Streaming/Channels/201`
- Channel 2 Sub Stream: `/Streaming/Channels/202`

### Dahua Cameras

**Example Models**: IPC-HDW, IPC-HFW series

**Auto-Configuration:**
- Vendor: `Dahua`
- IP Address: `192.168.1.100`
- Port: `554`
- Username: `admin`
- Password: `your_password`

**Generated Stream URL:**
```
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
```

**Manual RTSP Paths:**
- Main Stream: `/cam/realmonitor?channel=1&subtype=0`
- Sub Stream: `/cam/realmonitor?channel=1&subtype=1`

### Amcrest Cameras

**Example Models**: IP2M, IP4M, IP8M series

**Auto-Configuration:**
- Vendor: `Amcrest`
- IP Address: `192.168.1.100`
- Port: `554`
- Username: `admin`
- Password: `your_password`

**Generated Stream URL:**
```
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
```

**Note**: Amcrest uses same RTSP format as Dahua (they're the same company).

### Axis Cameras

**Example Models**: M30 series, P series, Q series

**Auto-Configuration:**
- Vendor: `Axis`
- IP Address: `192.168.1.100`
- Port: `554`
- Username: `root` (Axis default is 'root', not 'admin')
- Password: `your_password`

**Generated Stream URL:**
```
rtsp://root:password@192.168.1.100:554/axis-media/media.amp
```

**Manual RTSP Paths:**
- Default: `/axis-media/media.amp`
- With resolution: `/axis-media/media.amp?resolution=640x480`

### Custom/Other Cameras

For cameras not in the vendor list, you'll need to find the RTSP path from:
1. Camera manufacturer's documentation
2. Camera web interface (usually has stream URL)
3. Online RTSP path database: https://www.ispyconnect.com/sources.aspx

**Generic RTSP URL format:**
```
rtsp://username:password@camera-ip:port/path
```

**Common generic paths to try:**
```
/stream1
/live
/media
/h264
/cam1
/videoMain
```

---

## Testing Camera Connection

### Quick Test with VLC Media Player

Before adding to SquirrelNVR, test the RTSP stream with VLC:

1. Download VLC: https://www.videolan.org/
2. Open VLC → Media → Open Network Stream
3. Enter your RTSP URL:
   ```
   rtsp://admin:password@192.168.1.100:554/h264Preview_01_main
   ```
4. Click Play

**If video plays in VLC:**
- ✅ Stream URL is correct
- ✅ Credentials are correct
- ✅ Camera is accessible
- → Use same URL in SquirrelNVR

**If video doesn't play in VLC:**
- ❌ Check IP address
- ❌ Check username/password
- ❌ Check RTSP path
- ❌ Check camera is on network

### Test with FFmpeg

If FFmpeg is installed:

```powershell
ffmpeg -i "rtsp://admin:password@192.168.1.100:554/h264Preview_01_main" -frames:v 1 test.jpg
```

Should create a test.jpg snapshot if connection works.

---

## Troubleshooting

### Camera Shows "Offline" Status

**Problem**: Camera appears in list but shows red "Offline" status

**Solutions:**

1. **Check IP Address**
   ```powershell
   ping 192.168.1.100
   ```
   Should reply with packets. If "Request timed out", check camera is powered on and on network.

2. **Verify Credentials**
   - Try logging into camera's web interface: http://192.168.1.100
   - Use same username/password in SquirrelNVR

3. **Test RTSP URL with VLC** (see above)

4. **Check Camera RTSP is Enabled**
   - Log into camera web interface
   - Go to Network or Streaming settings
   - Ensure RTSP is enabled
   - Note the RTSP port (usually 554)

5. **Check Firewall**
   - Camera firewall might block RTSP
   - Windows Firewall might block incoming connections
   - Temporarily disable to test

6. **Check Stream Path**
   - Different camera models use different paths
   - Check camera documentation
   - Try alternative paths (see brand sections above)

### Camera Connects But No Video in Live View

**Problem**: Camera shows "Online" but live view is blank

**Solutions:**

1. **Check FFmpeg is Installed**
   ```powershell
   ffmpeg -version
   ```
   If error, install FFmpeg (see WINDOWS-SETUP.md)

2. **Check GPU Acceleration Settings**
   - Edit `.env` file
   - Verify GPU_TYPE and HARDWARE_ACCEL are set correctly
   - Try setting to `none` for testing:
     ```env
     GPU_TYPE=none
     HARDWARE_ACCEL=none
     ```

3. **Check Backend Logs**
   - Look in console where `npm start` is running
   - Look for FFmpeg errors
   - Look for stream processing errors

4. **Check Browser Console**
   - Press F12 in browser
   - Look for errors in Console tab
   - Look for network errors

### Stream URL Not Auto-Generating

**Problem**: Stream URL field stays empty when entering IP address

**Solutions:**

1. **Make sure you selected a Vendor** from dropdown (not "Custom/Other")
2. **Enter IP Address** in the IP Address field (not Stream URL field)
3. **Stream URL will show** in the Stream URL field after you enter IP

### Authentication Failures

**Problem**: Errors about authentication or 401 Unauthorized

**Solutions:**

1. **Check Default Credentials**
   - Reolink: admin / (camera password)
   - Hikvision: admin / 12345 or camera password
   - Dahua: admin / admin
   - Amcrest: admin / (camera password)
   - Axis: root / (camera password)

2. **Reset Camera Password**
   - Use manufacturer's tool to reset password
   - Set a new password you know

3. **Special Characters in Password**
   - If password has special characters (@, #, %, etc.)
   - They may need URL encoding
   - Try changing to alphanumeric password

### Camera Connects Intermittently

**Problem**: Camera connects then disconnects repeatedly

**Solutions:**

1. **Check Network Stability**
   - Wired connection better than WiFi
   - Check cable connections
   - Check switch/router

2. **Check Camera Load**
   - Too many connections to camera
   - Disable other apps accessing camera
   - Check camera's max connection limit

3. **Reduce Stream Quality**
   - Use sub-stream instead of main stream
   - Lower resolution/bitrate in camera settings

### Port 554 Already in Use

**Problem**: Error says port 554 is already in use

**Solution**: Another service is using RTSP port. Common culprits:
- Another NVR software
- Camera manufacturer's software
- Stop conflicting software or change camera to different port

---

## Common Camera Settings

### Recommended Initial Settings

For testing and getting started:

```
Camera Name: Test Camera 1
Vendor: (your camera brand)
IP Address: (your camera IP)
Port: 554
Username: admin
Password: (your camera password)
Enable Camera: ✅ Yes
Recording Mode: Continuous
Recording Quality: High
Recording FPS: 30
AI Enabled: ✅ Yes (if using AI features)
Motion Sensitivity: 50
```

### Production Recommendations

**For 24/7 Recording:**
```
Recording Mode: Continuous
Recording Quality: High
Retention: 30 days (adjust based on storage)
```

**For Motion-Only Recording:**
```
Recording Mode: Motion
Motion Sensitivity: 50-70 (adjust to reduce false triggers)
Pre-Record: 5 seconds
Post-Record: 10 seconds
```

**For Storage Optimization:**
```
Recording Quality: Medium
Recording FPS: 15
Use sub-stream when possible
```

---

## Next Steps After Camera is Connected

1. **Configure Motion Zones** (if using motion detection)
   - Define areas to monitor
   - Exclude areas with trees, flags, etc.

2. **Set Up Alarms** (optional)
   - Go to Alarms page
   - Create alarm rule for motion detection
   - Configure email notifications

3. **Enable AI Detection** (optional)
   - Ensure CodeProject.AI is installed and running
   - Camera → AI tab → Enable AI
   - Select detection types (person, vehicle, etc.)

4. **Configure Storage**
   - Settings page → Storage
   - Set retention days
   - Set max storage GB
   - Configure cleanup schedule

5. **Test Recording Playback**
   - Go to Recordings page
   - Wait a few minutes for recordings to accumulate
   - Click on a recording to play back

---

## Example Complete Camera Configurations

### Example 1: Reolink RLC-410

```
Basic Tab:
  Camera Name: Front Door
  Vendor: Reolink
  Model: RLC-410
  IP Address: 192.168.1.100
  Port: 554

Stream Tab:
  Stream Type: RTSP
  Stream URL: (auto-generated)
  Username: admin
  Password: MyPassword123

Recording Tab:
  Enable Camera: ✅
  Recording Mode: Continuous
  Recording Quality: High
  Recording FPS: 30

AI & Motion Tab:
  AI Enabled: ✅
  Motion Sensitivity: 60
```

### Example 2: Hikvision DS-2CD2142FWD

```
Basic Tab:
  Camera Name: Backyard
  Vendor: Hikvision
  Model: DS-2CD2142FWD
  IP Address: 192.168.1.101
  Port: 554

Stream Tab:
  Stream Type: RTSP
  Stream URL: (auto-generated)
  Username: admin
  Password: CameraPass456

Recording Tab:
  Enable Camera: ✅
  Recording Mode: Motion + Scheduled
  Recording Quality: Medium
  Recording FPS: 15

AI & Motion Tab:
  AI Enabled: ✅
  Motion Sensitivity: 50
  Detection Types: person, vehicle
```

---

## Support Resources

### Camera Manufacturer Support

- **Reolink**: https://support.reolink.com/
- **Hikvision**: https://www.hikvision.com/en/support/
- **Dahua**: https://www.dahuasecurity.com/support
- **Amcrest**: https://amcrest.com/support
- **Axis**: https://www.axis.com/support

### RTSP Path Database

- **iSpy Database**: https://www.ispyconnect.com/sources.aspx
- Search by camera brand/model for RTSP paths

### FFmpeg Documentation

- **FFmpeg**: https://ffmpeg.org/documentation.html
- For troubleshooting streaming issues

---

## Quick Reference Card

Print or save this for quick camera setup:

```
┌─────────────────────────────────────────────┐
│ QUICK CAMERA SETUP CHECKLIST                │
├─────────────────────────────────────────────┤
│ 1. Backend running? (npm start)         □  │
│ 2. Camera IP address: _________________     │
│ 3. Camera username: admin                   │
│ 4. Camera password: _________________       │
│ 5. Test with VLC first               □  │
│ 6. Add to SquirrelNVR                    □  │
│ 7. Check status (Online?)                □  │
│ 8. View in Live View                     □  │
└─────────────────────────────────────────────┘

Common RTSP Format:
rtsp://username:password@camera-ip:554/path

Reolink:      /h264Preview_01_main
Hikvision:    /Streaming/Channels/101
Dahua:        /cam/realmonitor?channel=1&subtype=0
Amcrest:      /cam/realmonitor?channel=1&subtype=0
Axis:         /axis-media/media.amp
```

---

**Good luck connecting your cameras! 🐿️📹**
