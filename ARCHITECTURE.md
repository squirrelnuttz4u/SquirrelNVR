# SquirrelNVR Architecture

## System Overview

SquirrelNVR is a full-stack NVR (Network Video Recorder) solution built with a modern microservices-inspired architecture. The system is designed to handle multiple IP camera streams, perform AI-based object detection, manage recordings, and provide real-time monitoring capabilities.

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Web Framework**: Express.js
- **Database**: TypeORM with SQLite/PostgreSQL
- **Video Processing**: FFmpeg with hardware acceleration
- **Real-time Communication**: WebSocket (ws)
- **Stream Server**: Node-Media-Server for RTSP/RTMP handling

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context API
- **Video Player**: Video.js with HLS support
- **HTTP Client**: Axios

### AI Integration
- **CodeProject.AI Server**: REST API integration for object/face detection
- **Frigate**: MQTT/HTTP integration for specialized camera AI
- **License Plate Recognition**: Integrated LPR pipeline

## Architecture Layers

### 1. Presentation Layer (Frontend)
```
┌─────────────────────────────────────────┐
│          React Application              │
├─────────────────────────────────────────┤
│  - Live View Grid                       │
│  - Camera Management                    │
│  - Recording Playback                   │
│  - AI Events Browser                    │
│  - Alarm Configuration                  │
│  - System Settings                      │
└─────────────────────────────────────────┘
```

### 2. API Layer (Backend)
```
┌─────────────────────────────────────────┐
│         Express REST API                │
├─────────────────────────────────────────┤
│  /api/auth       - Authentication       │
│  /api/cameras    - Camera management    │
│  /api/recordings - Recording access     │
│  /api/detections - AI detection data    │
│  /api/alarms     - Alarm management     │
│  /api/system     - System settings      │
└─────────────────────────────────────────┘
```

### 3. Service Layer
```
┌─────────────────────────────────────────┐
│            Core Services                │
├─────────────────────────────────────────┤
│  - StreamManager                        │
│  - RecordingEngine                      │
│  - AIDetectionCoordinator               │
│  - AlarmCoordinator                     │
│  - NotificationService                  │
│  - StorageManager                       │
└─────────────────────────────────────────┘
```

### 4. Data Layer
```
┌─────────────────────────────────────────┐
│          Database (TypeORM)             │
├─────────────────────────────────────────┤
│  - Camera                               │
│  - Recording                            │
│  - AIDetection                          │
│  - LicensePlate                         │
│  - Alarm                                │
│  - AlarmEvent                           │
│  - User                                 │
│  - SystemSettings                       │
└─────────────────────────────────────────┘
```

## Core Components

### StreamManager
**Responsibility**: Manage live camera streams

- Initiates FFmpeg processes for each camera
- Converts camera streams to HLS for web playback
- Handles hardware acceleration (CUDA/QSV/AMF)
- Manages stream lifecycle (start/stop)
- Captures snapshots on demand
- Tracks viewer counts

**Key Features**:
- Automatic reconnection on stream failure
- Configurable video quality and FPS
- Support for multiple stream types (RTSP, RTMP, HLS, MJPEG)
- ONVIF camera discovery and control

### RecordingEngine
**Responsibility**: Handle video recording

- Continuous recording mode
- Motion-triggered recording
- Scheduled recording
- Pre/post-record buffering
- Thumbnail generation
- Recording metadata management

**Key Features**:
- Per-camera recording configurations
- Hardware-accelerated encoding
- Automatic file segmentation
- Integration with storage manager

### AIDetectionCoordinator
**Responsibility**: Coordinate AI detection across cameras

- Schedule periodic frame analysis
- Dispatch frames to CodeProject.AI and Frigate
- Process detection results
- Associate detections with recordings
- Trigger alarms based on detections

**Detection Types**:
- Person
- Vehicle
- Animal
- Package
- Face
- License Plate
- Custom models

### AlarmCoordinator
**Responsibility**: Manage alarm rules and events

- Monitor for alarm triggers (motion, AI detections)
- Evaluate alarm conditions and schedules
- Create alarm events
- Trigger notifications
- Handle event acknowledgment

**Trigger Types**:
- Motion detection
- AI object detection
- Specific detection types
- Confidence thresholds
- Time schedules

### NotificationService
**Responsibility**: Send notifications

- Email notifications with attachments
- Webhook notifications
- Notification scheduling
- Template-based messages

**Channels**:
- SMTP email
- HTTP webhooks
- (Future: Push notifications)

### StorageManager
**Responsibility**: Manage recording storage

- Monitor storage usage
- Enforce retention policies
- Automatic cleanup of old recordings
- Orphaned file detection
- Per-camera storage limits

**Features**:
- Configurable retention periods
- Storage quota enforcement
- Scheduled cleanup tasks

## Data Flow

### Live Streaming Flow
```
IP Camera → StreamManager → FFmpeg → HLS Segments → Web Browser
                ↓
           Database (status updates)
                ↓
           WebSocket → Frontend (real-time updates)
```

### Recording Flow
```
IP Camera → RecordingEngine → FFmpeg → MP4 Files → Storage
                ↓
          Generate Thumbnail
                ↓
           Save Recording Metadata → Database
```

### AI Detection Flow
```
StreamManager (snapshot) → AIDetectionCoordinator
                ↓
        ┌───────┴───────┐
        ↓               ↓
   CodeProject.AI    Frigate
        ↓               ↓
        └───────┬───────┘
                ↓
         Process Results
                ↓
         Save to Database
                ↓
         Trigger Alarms
                ↓
         Send Notifications
```

### Alarm Flow
```
Event (Motion/AI) → AlarmCoordinator
                ↓
         Check Alarm Rules
                ↓
         Evaluate Conditions
                ↓
         Create Alarm Event
                ↓
    ┌────────┴────────┐
    ↓                 ↓
Take Snapshot    Send Notifications
    ↓                 ↓
Save Event       Email/Webhook
    ↓
 Database
```

## Hardware Acceleration

### GPU Support
```
┌─────────────────────────────────────────┐
│          GPU Acceleration               │
├─────────────────────────────────────────┤
│  NVIDIA: CUDA (h264_nvenc, hevc_nvenc)  │
│  Intel:  QSV  (h264_qsv, hevc_qsv)      │
│  AMD:    AMF  (h264_amf, hevc_amf)      │
└─────────────────────────────────────────┘
```

### Performance Benefits
- 5-10x faster encoding
- Lower CPU usage
- Higher concurrent stream capacity
- Better video quality at lower bitrates

## Security Architecture

### Authentication & Authorization
```
┌─────────────────────────────────────────┐
│           Security Layer                │
├─────────────────────────────────────────┤
│  - JWT token-based authentication       │
│  - Role-based access control (RBAC)     │
│  - Password hashing (bcrypt)            │
│  - Secure session management            │
└─────────────────────────────────────────┘
```

### Roles
- **Admin**: Full system access
- **User**: View and playback access
- **Viewer**: Read-only access

## Scalability Considerations

### Horizontal Scaling
- Database: PostgreSQL with read replicas
- Load Balancing: Multiple server instances
- Shared Storage: NFS/S3 for recordings

### Vertical Scaling
- GPU acceleration for more cameras
- SSD storage for better I/O
- More RAM for larger buffers

### Performance Optimizations
- HLS chunking for efficient streaming
- Thumbnail caching
- Database indexing on common queries
- WebSocket for real-time updates (vs polling)

## Deployment Architecture

### Single Server (Small/Medium)
```
┌────────────────────────────────────┐
│        Server (Windows/Linux)      │
├────────────────────────────────────┤
│  SquirrelNVR                       │
│  SQLite Database                   │
│  Local Storage                     │
│  CodeProject.AI (optional)         │
│  Frigate (optional)                │
└────────────────────────────────────┘
```

### Distributed (Large)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  NVR Server │  │  AI Server  │  │   Storage   │
│  (Node.js)  │→ │  (GPU)      │  │   (NAS/S3)  │
└──────┬──────┘  └─────────────┘  └─────────────┘
       ↓
┌──────────────┐
│  PostgreSQL  │
│   Database   │
└──────────────┘
```

## API Design

### RESTful Endpoints
- Resource-based URLs
- Standard HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response bodies
- JWT authentication headers
- Pagination for list endpoints
- Error handling with standard codes

### WebSocket Events
- Real-time status updates
- Stream state changes
- Recording events
- AI detection notifications
- Alarm triggers

## Error Handling

### Strategy
- Graceful degradation
- Automatic retry for transient failures
- Detailed logging at all levels
- User-friendly error messages
- System health monitoring

## Future Enhancements

- **Multi-server clustering**: Distributed NVR architecture
- **Cloud integration**: Cloud storage and remote access
- **Mobile apps**: Native iOS and Android applications
- **Advanced analytics**: Heat maps, people counting, behavior analysis
- **Facial recognition**: Person identification and tracking
- **ONVIF PTZ control**: Camera pan/tilt/zoom control
- **2-way audio**: Talk through cameras
- **Video analytics**: Line crossing, object left/removed, loitering detection
