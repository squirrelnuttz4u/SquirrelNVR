# SquirrelNVR - Advanced Features Summary

## 🎯 AI Model Management

### Easy Model Addition
- **Built-in Model Registry**: Pre-configured models for CodeProject.AI and Frigate
- **Custom Model Support**: Add your own AI models via REST API
- **Model Types**: Object detection, face detection, license plate recognition, custom
- **80+ Detection Classes**: Full COCO dataset support (person, car, dog, cat, etc.)

### API Endpoints
```
GET  /api/ai-models              - List all AI models
GET  /api/ai-models/enabled      - List enabled models
GET  /api/ai-models/classes      - Get all detection classes
GET  /api/ai-models/:id/classes  - Get classes for specific model
POST /api/ai-models              - Add custom model
PATCH /api/ai-models/:id/enabled - Enable/disable model
POST /api/ai-models/:id/test     - Test model availability
DELETE /api/ai-models/:id        - Remove custom model
GET  /api/ai-models/stats        - Get model statistics
```

### Adding a Custom Model
```javascript
POST /api/ai-models
{
  "name": "Custom YOLO Model",
  "description": "Custom trained model for specific objects",
  "endpoint": "http://my-server/detect",
  "supportedClasses": ["custom_object_1", "custom_object_2"],
  "config": {
    "threshold": 0.5,
    "nms": 0.4
  }
}
```

## 🎨 Object Class Filtering

### Selective Detection
- **Per-Camera Filtering**: Each camera can detect only specific object classes
- **Reduce False Positives**: Ignore irrelevant detections (e.g., ignore animals, only detect people & vehicles)
- **Performance Boost**: Less processing and storage for unwanted detections
- **Easy Configuration**: Simple JSON array of allowed classes

### Configuration Example
```javascript
// Camera settings
{
  "filteredDetectionClasses": ["person", "car", "truck", "motorcycle"],
  "aiSensitivity": 70
}
```

**Result**: This camera will ONLY detect people and vehicles, ignoring dogs, cats, birds, and all other objects.

### Available Detection Classes (80+ total)
**People:**
- person, face

**Vehicles:**
- car, truck, bus, motorcycle, bicycle, boat, airplane, train

**Animals:**
- dog, cat, bird, horse, sheep, cow, elephant, bear, zebra, giraffe

**Objects:**
- backpack, suitcase, handbag, bottle, laptop, cell phone, etc.

## 🎬 Recording Modes

### 6 Recording Modes

1. **Continuous** (`continuous`)
   - Record 24/7 regardless of events
   - Best for: Critical areas, maximum coverage

2. **Motion** (`motion`)
   - Record only when motion detected
   - Configurable sensitivity (0-100)
   - Pre/post-record buffering
   - Best for: Storage saving, event-based recording

3. **AI Detection** (`ai_detection`) **NEW!**
   - Record ONLY when AI detects specific objects
   - Triggered by filtered detection classes
   - Minimum confidence threshold
   - Best for: Smart recording, reduce false motion triggers

4. **Scheduled** (`scheduled`)
   - Record during specific times/days
   - Multiple schedules per camera
   - Best for: Business hours, scheduled monitoring

5. **Motion + Scheduled** (`motion_and_scheduled`)
   - Motion detection ONLY during scheduled times
   - Best for: Combining both approaches

6. **Motion OR AI** (`motion_or_ai`) **NEW!**
   - Record when EITHER motion OR AI detection occurs
   - Best for: Maximum event capture with smart filtering

### Motion Sensitivity

#### Configurable Per Camera
```javascript
{
  "motionEnabled": true,
  "motionSensitivity": 75,  // 0-100 (higher = more sensitive)
  "motionZones": [           // Optional: Define specific areas
    {
      "id": "zone1",
      "name": "Driveway",
      "points": [{"x": 100, "y": 100}, {"x": 500, "y": 100}, ...],
      "sensitivity": 80      // Zone-specific sensitivity
    }
  ]
}
```

#### How It Works
- **0-30**: Low sensitivity - Only major movements
- **31-60**: Medium sensitivity - Normal movement detection
- **61-85**: High sensitivity - Sensitive to small movements
- **86-100**: Very high sensitivity - Detect even minor changes

### AI-Triggered Recording

#### Configuration
```javascript
{
  "recordingMode": "ai_detection",  // or "motion_or_ai"
  "aiSensitivity": 70,               // Minimum confidence (0-100)
  "filteredDetectionClasses": [      // Only these objects trigger recording
    "person",
    "car",
    "truck"
  ],
  "preRecordSeconds": 5,             // Record 5 seconds before detection
  "postRecordSeconds": 10            // Continue 10 seconds after last detection
}
```

#### Benefits
1. **Smart Recording**: Only record what matters
2. **Reduce Storage**: Skip irrelevant motion (trees, animals, etc.)
3. **Faster Review**: All recordings contain events of interest
4. **Lower Bandwidth**: Less data to stream and store

#### Example Scenarios

**Parking Lot Camera:**
```javascript
{
  "recordingMode": "ai_detection",
  "filteredDetectionClasses": ["person", "car", "truck", "motorcycle"],
  "aiSensitivity": 65
}
// Records only when vehicles or people appear, ignores birds, leaves, etc.
```

**Front Door Camera:**
```javascript
{
  "recordingMode": "motion_or_ai",
  "filteredDetectionClasses": ["person", "package"],
  "motionSensitivity": 60,
  "aiSensitivity": 70
}
// Records on any motion, but AI helps identify people and packages
```

**Wildlife Camera (Negative Example):**
```javascript
{
  "recordingMode": "ai_detection",
  "filteredDetectionClasses": ["bird", "dog", "cat", "bear", "deer"],
  "aiSensitivity": 50
}
// Records only animals, ignores people and vehicles
```

## 📊 Detection Class Statistics

### Per-Camera Statistics
Track which classes are detected most frequently:
```
GET /api/detections?cameraId=xyz&groupBy=label

Response:
{
  "person": 156,
  "car": 89,
  "dog": 23,
  "bicycle": 12
}
```

### Filter Performance
See how filtering reduces detections:
```
Before filtering: 500 detections (person, car, dog, cat, bird, etc.)
After filtering:   187 detections (person, car only)
Reduction:        62.6%
```

## 🔧 Advanced Configuration

### Multi-Stage Detection
Combine multiple detection strategies:

1. **Motion Zones**: Define areas where motion should be detected
2. **Detection Zones**: Define areas where AI should analyze
3. **Filtered Classes**: Define which objects matter
4. **Recording Mode**: Choose when to record

### Example: Parking Garage
```javascript
{
  "name": "Parking Garage Exit",
  "recordingMode": "motion_or_ai",

  // Motion detection setup
  "motionEnabled": true,
  "motionSensitivity": 70,
  "motionZones": [
    {
      "name": "Exit Lane",
      "points": [...],  // Focus on exit lane only
      "sensitivity": 75
    }
  ],

  // AI detection setup
  "aiEnabled": true,
  "aiProvider": "both",  // Use both CodeProject.AI and Frigate
  "aiModels": ["object_detection", "license_plate"],
  "aiSensitivity": 65,
  "filteredDetectionClasses": [
    "person", "car", "truck", "motorcycle", "license_plate"
  ],
  "detectionZones": [
    {
      "name": "Plate Reading Zone",
      "points": [...],  // Specific area for license plate reading
      "detectionTypes": ["license_plate"]
    }
  ],

  // Recording settings
  "preRecordSeconds": 3,
  "postRecordSeconds": 7,
  "recordingQuality": "high"
}
```

## 🎓 Best Practices

### Storage Optimization
1. Use **AI Detection mode** for cameras with lots of irrelevant motion
2. Set **filtered classes** to only what matters for each camera
3. Adjust **sensitivity** to reduce false positives
4. Use **detection zones** to focus on specific areas

### Accuracy Improvements
1. Start with **lower sensitivity** (50-60) and increase if needed
2. Use **both** AI providers for redundancy
3. Enable **pre-record buffering** to catch full events
4. Review and adjust **filtered classes** based on statistics

### Performance Tuning
1. Limit **filtered classes** to reduce processing
2. Disable AI on **continuous recording** cameras (save processing)
3. Use **detection zones** instead of analyzing entire frame
4. Lower **AI detection FPS** for less critical cameras (default: 2 FPS)

## 📈 Monitoring

### Real-time Metrics
- Detections per second
- Filtered vs total detections
- Recording triggers (motion vs AI)
- Storage saved by filtering
- AI processing time

### Alerts
- Low detection rate (possible camera issue)
- High false positive rate (adjust sensitivity)
- Model unavailable
- Storage threshold reached

---

**All features are accessible via the Web UI and REST API!**
