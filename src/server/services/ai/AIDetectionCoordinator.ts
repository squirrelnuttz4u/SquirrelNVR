import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger';
import { AppDataSource } from '../../database';
import { Camera, AIDetection, LicensePlate, Recording } from '../../database/entities';
import { AIProvider, DetectionType } from '../../../shared/types';
import codeProjectAI from './CodeProjectAI';
import frigate from './Frigate';
import streamManager from '../camera/StreamManager';
import recordingEngine from '../recording/RecordingEngine';

export class AIDetectionCoordinator extends EventEmitter {
  private detectionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize AI detection services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing AI detection services...');

    // Check CodeProject.AI availability
    const codeProjectAvailable = await codeProjectAI.isAvailable();
    if (codeProjectAvailable) {
      logger.info('✓ CodeProject.AI server is available');
    } else {
      logger.warn('⚠ CodeProject.AI server is not available');
    }

    // Initialize Frigate
    await frigate.initialize();

    // Listen to Frigate events
    frigate.on('event', (event) => {
      this.handleFrigateEvent(event);
    });

    this.isInitialized = true;
    logger.info('✓ AI detection coordinator initialized');
  }

  /**
   * Start AI detection for a camera
   */
  async startDetection(camera: Camera): Promise<void> {
    if (!camera.aiEnabled) {
      logger.debug(`AI detection disabled for camera ${camera.name}`);
      return;
    }

    if (this.detectionIntervals.has(camera.id)) {
      logger.debug(`AI detection already running for camera ${camera.name}`);
      return;
    }

    logger.info(`Starting AI detection for camera ${camera.name} (provider: ${camera.aiProvider})`);

    // Determine detection interval based on AI detection FPS
    const interval = 1000 / 2; // Default 2 FPS

    const timer = setInterval(async () => {
      await this.performDetection(camera);
    }, interval);

    this.detectionIntervals.set(camera.id, timer);
  }

  /**
   * Perform AI detection on camera snapshot
   */
  private async performDetection(camera: Camera): Promise<void> {
    try {
      // Capture snapshot
      const snapshotPath = await streamManager.captureSnapshot(camera);

      let detections: any[] = [];

      // Run detection based on provider
      if (camera.aiProvider === AIProvider.CODEPROJECT || camera.aiProvider === AIProvider.BOTH) {
        const codeProjectDetections = await this.runCodeProjectAI(camera, snapshotPath);
        detections = detections.concat(codeProjectDetections);
      }

      // Process detections
      for (const detection of detections) {
        await this.saveDetection(camera, detection, snapshotPath);

        // Emit event for alarm system
        this.emit('detection', {
          cameraId: camera.id,
          detection,
        });
      }

      // Clean up snapshot if no detections
      if (detections.length === 0 && fs.existsSync(snapshotPath)) {
        fs.unlinkSync(snapshotPath);
      }
    } catch (error) {
      logger.error(`AI detection error for camera ${camera.name}:`, error);
    }
  }

  /**
   * Run CodeProject.AI detection
   */
  private async runCodeProjectAI(camera: Camera, imagePath: string): Promise<any[]> {
    const detections: any[] = [];

    try {
      // Parse AI models from camera config
      const models = JSON.parse(camera.aiModels || '[]');

      // Object detection
      if (models.includes('object_detection') || models.length === 0) {
        const objects = await codeProjectAI.detectObjects(imagePath);
        for (const obj of objects) {
          if (obj.confidence >= camera.aiSensitivity / 100) {
            detections.push({
              provider: AIProvider.CODEPROJECT,
              type: codeProjectAI.mapLabelToType(obj.label),
              label: obj.label,
              confidence: obj.confidence,
              boundingBox: {
                x: obj.x_min,
                y: obj.y_min,
                width: obj.x_max - obj.x_min,
                height: obj.y_max - obj.y_min,
              },
              modelName: 'object_detection',
            });
          }
        }
      }

      // Face detection
      if (models.includes('face_detection')) {
        const faces = await codeProjectAI.detectFaces(imagePath);
        for (const face of faces) {
          if (face.confidence >= camera.aiSensitivity / 100) {
            detections.push({
              provider: AIProvider.CODEPROJECT,
              type: DetectionType.FACE,
              label: 'face',
              confidence: face.confidence,
              boundingBox: {
                x: face.x_min,
                y: face.y_min,
                width: face.x_max - face.x_min,
                height: face.y_max - face.y_min,
              },
              modelName: 'face_detection',
            });
          }
        }
      }

      // License plate recognition
      if (models.includes('license_plate')) {
        const plates = await codeProjectAI.recognizeLicensePlate(imagePath);
        for (const plate of plates) {
          if (plate.confidence >= camera.aiSensitivity / 100) {
            detections.push({
              provider: AIProvider.CODEPROJECT,
              type: DetectionType.LICENSE_PLATE,
              label: plate.plate,
              confidence: plate.confidence,
              boundingBox: {
                x: plate.x_min,
                y: plate.y_min,
                width: plate.x_max - plate.x_min,
                height: plate.y_max - plate.y_min,
              },
              modelName: 'license_plate',
              plateNumber: plate.plate,
            });
          }
        }
      }

      // Custom models
      for (const model of models) {
        if (!['object_detection', 'face_detection', 'license_plate'].includes(model)) {
          const results = await codeProjectAI.customDetection(imagePath, model);
          for (const result of results) {
            if (result.confidence >= camera.aiSensitivity / 100) {
              detections.push({
                provider: AIProvider.CODEPROJECT,
                type: codeProjectAI.mapLabelToType(result.label),
                label: result.label,
                confidence: result.confidence,
                boundingBox: {
                  x: result.x_min,
                  y: result.y_min,
                  width: result.x_max - result.x_min,
                  height: result.y_max - result.y_min,
                },
                modelName: model,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('CodeProject.AI detection error:', error);
    }

    return detections;
  }

  /**
   * Handle Frigate event
   */
  private async handleFrigateEvent(event: any): Promise<void> {
    try {
      // Find camera by name (Frigate camera name should match our camera ID or name)
      const cameraRepo = AppDataSource.getRepository(Camera);
      const camera = await cameraRepo.findOne({
        where: [
          { id: event.camera },
          { name: event.camera },
        ],
      });

      if (!camera || !camera.aiEnabled) {
        return;
      }

      // Only process new events
      if (event.type !== 'new') {
        return;
      }

      logger.debug(`Frigate event: ${event.label} detected on ${event.camera}`);

      // Get snapshot from Frigate
      const snapshot = await frigate.getEventSnapshot(event.id);
      if (!snapshot) {
        return;
      }

      // Save snapshot
      const snapshotDir = path.join(process.cwd(), 'recordings', 'snapshots');
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }

      const snapshotPath = path.join(snapshotDir, `frigate_${event.id}.jpg`);
      fs.writeFileSync(snapshotPath, snapshot);

      // Create detection object
      const detection = {
        provider: AIProvider.FRIGATE,
        type: frigate.mapLabelToType(event.after.label),
        label: event.after.label,
        confidence: event.after.score,
        boundingBox: {
          x: event.after.box[0],
          y: event.after.box[1],
          width: event.after.box[2],
          height: event.after.box[3],
        },
        modelName: 'frigate',
        metadata: {
          eventId: event.id,
          zones: event.after.current_zones,
        },
      };

      await this.saveDetection(camera, detection, snapshotPath);

      this.emit('detection', {
        cameraId: camera.id,
        detection,
      });
    } catch (error) {
      logger.error('Error handling Frigate event:', error);
    }
  }

  /**
   * Save detection to database
   */
  private async saveDetection(camera: Camera, detection: any, snapshotPath: string): Promise<void> {
    try {
      const detectionRepo = AppDataSource.getRepository(AIDetection);

      // Get current recording if exists
      const recordingSession = recordingEngine.getSession(camera.id);

      const aiDetection = detectionRepo.create({
        cameraId: camera.id,
        recordingId: recordingSession?.recording.id,
        timestamp: new Date(),
        detectionType: detection.type,
        confidence: detection.confidence,
        label: detection.label,
        boundingBox: JSON.stringify(detection.boundingBox),
        snapshotPath,
        metadata: JSON.stringify(detection.metadata || {}),
        provider: detection.provider,
        modelName: detection.modelName,
      });

      await detectionRepo.save(aiDetection);

      // If this is a license plate detection, save it separately
      if (detection.type === DetectionType.LICENSE_PLATE && detection.plateNumber) {
        await this.saveLicensePlate(camera, aiDetection, detection);
      }

      // Update recording to mark it has AI detections
      if (recordingSession) {
        const recordingRepo = AppDataSource.getRepository(Recording);
        recordingSession.recording.hasAI = true;
        await recordingRepo.save(recordingSession.recording);
      }

      logger.debug(`AI detection saved: ${detection.label} (${(detection.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      logger.error('Failed to save AI detection:', error);
    }
  }

  /**
   * Save license plate to database
   */
  private async saveLicensePlate(
    camera: Camera,
    detection: AIDetection,
    detectionData: any
  ): Promise<void> {
    try {
      const plateRepo = AppDataSource.getRepository(LicensePlate);

      const plate = plateRepo.create({
        cameraId: camera.id,
        detectionId: detection.id,
        plateNumber: detectionData.plateNumber,
        confidence: detectionData.confidence,
        timestamp: new Date(),
        snapshotPath: detection.snapshotPath,
        metadata: JSON.stringify(detectionData.metadata || {}),
      });

      await plateRepo.save(plate);

      logger.info(`License plate detected: ${detectionData.plateNumber}`);

      this.emit('license_plate', {
        cameraId: camera.id,
        plate: detectionData.plateNumber,
        confidence: detectionData.confidence,
      });
    } catch (error) {
      logger.error('Failed to save license plate:', error);
    }
  }

  /**
   * Stop AI detection for a camera
   */
  stopDetection(cameraId: string): void {
    const timer = this.detectionIntervals.get(cameraId);
    if (timer) {
      clearInterval(timer);
      this.detectionIntervals.delete(cameraId);
      logger.info(`AI detection stopped for camera ${cameraId}`);
    }
  }

  /**
   * Stop all AI detection
   */
  stopAll(): void {
    logger.info('Stopping all AI detection...');
    for (const [cameraId, timer] of this.detectionIntervals) {
      clearInterval(timer);
    }
    this.detectionIntervals.clear();
  }
}

export default new AIDetectionCoordinator();
