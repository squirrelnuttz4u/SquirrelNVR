# SquirrelNVR

**Professional Network Video Recorder (NVR) for IP Cameras with AI Recognition**

SquirrelNVR is a comprehensive, full-stack NVR solution designed for IP cameras with built-in AI recognition capabilities. It rivals commercial solutions like Blue Iris and Milestone, offering powerful features for video surveillance, recording, and intelligent detection.

## 🌟 Features

### Core Features
- **Multi-Camera Support**: Manage unlimited IP cameras
- **Multiple Stream Types**: RTSP, RTMP, HLS, MJPEG, and ONVIF support
- **GPU Acceleration**: Hardware acceleration for NVIDIA (CUDA), Intel (QSV), and AMD GPUs
- **High Performance**: Optimized for handling dozens of concurrent camera streams

### Recording
- **Flexible Recording Modes**: Continuous, motion-triggered, scheduled, or combined
- **Individual Camera Configuration**: Each camera can have unique settings
- **Pre/Post-Record Buffer**: Capture events before and after triggers
- **Smart Storage Management**: Automatic cleanup based on retention policies
- **Timeline Playback**: Easy navigation through recorded footage

### AI Detection
- **Dual AI Integration**:
  - **CodeProject.AI Server**: Versatile object detection and recognition
  - **Frigate**: Specialized for security camera AI
- **Multiple Detection Types**:
  - Person detection
  - Vehicle detection
  - Animal detection
  - Package detection
  - Face detection
  - Custom models
- **License Plate Recognition (LPR)**: Automatic license plate detection and database
- **Detection Zones**: Define specific areas for AI detection
- **Confidence Thresholds**: Configurable sensitivity per camera

### Alarms & Notifications
- **Smart Alarms**: Trigger on motion, AI detections, or both
- **Multi-Channel Notifications**:
  - Email notifications with snapshots
  - Webhooks for integration
  - Scheduled notification windows
- **Alarm Severity Levels**: Low, Medium, High, Critical
- **Event History**: Complete alarm event log with acknowledgment

### Storage
- **Flexible Storage**: Configure storage location and limits
- **Per-Camera Retention**: Individual retention policies
- **Auto-Cleanup**: Automatic deletion of old recordings
- **Storage Monitoring**: Real-time storage usage statistics
- **Efficient Storage**: H.264/H.265 encoding with hardware acceleration

### User Interface
- **Modern Web Interface**: Responsive React-based UI
- **Live View Grid**: Multi-camera live viewing
- **Timeline Playback**: Intuitive recording navigation
- **AI Events Browser**: Search and filter AI detections
- **LPR Database**: Search and manage detected license plates
- **Dashboard**: System overview and statistics

### Remote Access
- **Web-Based**: Access from any device with a web browser
- **WebSocket Updates**: Real-time status updates
- **Mobile Responsive**: Works on phones and tablets

### Enterprise Features
- **User Management**: Multiple users with role-based access
- **Audit Logging**: Complete system activity logs
- **Email Integration**: SMTP support for notifications
- **Database Options**: SQLite for simplicity, PostgreSQL for scale
- **Windows Service**: Run as a background service
- **API Access**: RESTful API for integrations

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10/11 or Linux (Ubuntu 20.04+, Debian 10+, CentOS 8+)
- **CPU**: Intel i5 or AMD Ryzen 5 (4+ cores recommended)
- **RAM**: 8 GB minimum, 16 GB recommended
- **Storage**: SSD recommended for database, HDD acceptable for recordings
- **Network**: Gigabit Ethernet recommended

### Software Requirements
- **Node.js**: Version 18 or higher
- **FFmpeg**: Version 4.0 or higher with hardware acceleration support
- **Database**: Built-in SQLite or PostgreSQL 12+

### Optional (for AI Features)
- **CodeProject.AI Server**: For object and face detection
- **Frigate**: For specialized camera AI detection
- **GPU**: NVIDIA GPU with CUDA, Intel GPU with QSV, or AMD GPU with AMF

## 🚀 Installation

### Quick Start (Windows)

1. **Prerequisites**:
   ```powershell
   # Install Node.js from https://nodejs.org/
   # Install FFmpeg from https://ffmpeg.org/download.html
   ```

2. **Install SquirrelNVR**:
   ```powershell
   git clone https://github.com/your-repo/SquirrelNVR.git
   cd SquirrelNVR
   scripts\setup.bat
   ```

3. **Configure**:
   - Edit `.env` file with your settings
   - Configure storage path, GPU settings, etc.

4. **Run**:
   ```powershell
   # Run directly
   npm start

   # Or install as Windows service
   npm run install:service
   ```

### Quick Start (Linux)

1. **Prerequisites**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y nodejs npm ffmpeg

   # CentOS/RHEL
   sudo yum install -y nodejs npm ffmpeg
   ```

2. **Install SquirrelNVR**:
   ```bash
   git clone https://github.com/your-repo/SquirrelNVR.git
   cd SquirrelNVR
   sudo ./scripts/setup.sh
   ```

3. **Configure**:
   ```bash
   nano .env  # Edit configuration
   ```

4. **Run**:
   ```bash
   # Start service
   sudo systemctl start squirrel-nvr

   # Enable autostart
   sudo systemctl enable squirrel-nvr

   # View logs
   sudo journalctl -u squirrel-nvr -f
   ```

## 🎯 Configuration

### Environment Variables

Edit the `.env` file to configure SquirrelNVR:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Storage
STORAGE_PATH=./recordings
MAX_STORAGE_GB=500
RETENTION_DAYS=30

# GPU Acceleration
GPU_TYPE=nvidia           # nvidia, intel, amd, none
HARDWARE_ACCEL=cuda       # cuda, qsv, amf

# AI Services
CODEPROJECT_AI_URL=http://localhost:32168
FRIGATE_URL=http://localhost:5000

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Adding Cameras

1. Log in to the web interface (default: http://localhost:3000)
2. Navigate to **Cameras** page
3. Click **Add Camera**
4. Enter camera details:
   - Name
   - Stream URL (e.g., `rtsp://192.168.1.100:554/stream`)
   - Credentials (if required)
   - Recording mode
   - AI settings

### Setting Up AI Detection

#### CodeProject.AI Server

1. Install CodeProject.AI Server:
   ```bash
   # Download from https://www.codeproject.com/AI/
   # Follow installation instructions
   ```

2. Configure in SquirrelNVR:
   ```bash
   CODEPROJECT_AI_URL=http://localhost:32168
   ```

#### Frigate

1. Install Frigate using Docker:
   ```bash
   docker run -d \
     --name frigate \
     --restart=unless-stopped \
     -v /path/to/config:/config \
     -p 5000:5000 \
     ghcr.io/blakeblackshear/frigate:stable
   ```

2. Configure in SquirrelNVR:
   ```bash
   FRIGATE_URL=http://localhost:5000
   ```

## 📖 Usage

### Live Viewing
- Navigate to **Live View** to see all active cameras
- Cameras display in a responsive grid
- Click on a camera to view full screen

### Recording Playback
- Go to **Recordings** page
- Search by camera, date range, or recording type
- Click on a recording to play
- Use timeline to navigate

### AI Detections
- **Detections** page shows all AI detection events
- Filter by detection type, camera, date
- View snapshots of detected objects

### License Plate Recognition
- **License Plates** page shows all detected plates
- Search by plate number
- View history of specific plates

### Alarms
- Configure alarm rules in **Alarms** page
- Set triggers (motion, AI detections)
- Configure notifications (email, webhook)
- View alarm events and acknowledge

## 🔧 Advanced Configuration

### GPU Acceleration

**NVIDIA CUDA**:
```bash
GPU_TYPE=nvidia
HARDWARE_ACCEL=cuda
```

**Intel QuickSync (QSV)**:
```bash
GPU_TYPE=intel
HARDWARE_ACCEL=qsv
```

**AMD AMF**:
```bash
GPU_TYPE=amd
HARDWARE_ACCEL=amf
```

### Database

**SQLite (default)**:
```bash
DB_TYPE=sqlite
DB_PATH=./data/squirrel-nvr.db
```

**PostgreSQL** (for larger deployments):
```bash
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=nvr_user
DB_PASSWORD=your_password
DB_NAME=squirrel_nvr
```

### Motion Detection Zones

Define zones in camera settings to focus motion detection on specific areas.

### Recording Schedules

Configure recording schedules per camera:
- Set days of week
- Define time ranges
- Combine with motion detection

## 🛠️ Troubleshooting

### Camera Not Connecting

1. Verify camera URL and credentials
2. Check network connectivity
3. Try different stream types (RTSP/RTMP/HTTP)
4. Check camera ONVIF settings

### No Video in Live View

1. Ensure FFmpeg is installed
2. Check GPU acceleration settings
3. Verify HLS output directory permissions
4. Check browser console for errors

### AI Detection Not Working

1. Verify CodeProject.AI or Frigate is running
2. Check service URLs in configuration
3. Ensure cameras have AI enabled
4. Review detection sensitivity settings

### Storage Issues

1. Check available disk space
2. Verify storage path permissions
3. Review retention settings
4. Check storage cleanup logs

## 📊 Performance Tuning

### For Many Cameras (20+)

```bash
MAX_CONCURRENT_STREAMS=32
MOTION_DETECTION_FPS=3
AI_DETECTION_FPS=1
```

### For High-Quality Recording

```bash
RECORDING_QUALITY=ultra
RECORDING_FPS=30
```

### For Resource-Constrained Systems

```bash
RECORDING_QUALITY=low
RECORDING_FPS=10
MOTION_DETECTION_FPS=3
AI_DETECTION_FPS=1
```

## 🔐 Security

- Change default admin password immediately
- Use strong passwords for all accounts
- Enable HTTPS for remote access (use reverse proxy)
- Restrict network access to NVR server
- Regularly update software

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/your-repo/SquirrelNVR/issues
- Documentation: https://docs.squirrelnvr.com

## 🙏 Acknowledgments

- FFmpeg team for video processing
- CodeProject.AI team for AI detection
- Frigate team for camera AI
- React and Material-UI teams
- Node.js and TypeScript communities

---

**Built with ❤️ for the open-source community**
