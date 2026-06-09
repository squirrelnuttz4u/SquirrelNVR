import { Router, Response } from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { AppDataSource } from '../database';
import { Camera, SystemSettings } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import streamManager from '../services/camera/StreamManager';
import OnvifService from '../services/camera/OnvifService';
import recordingEngine from '../services/recording/RecordingEngine';
import aiDetectionCoordinator from '../services/ai/AIDetectionCoordinator';
import motionDetector from '../services/motion/MotionDetector';
import logger from '../utils/logger';

const router = Router();

// In-memory upload for short push-to-talk audio clips (max 8 MB).
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/**
 * Build a stream URL with embedded credentials (used for the audio backchannel).
 */
function withCredentials(camera: Camera): string {
  let url = camera.streamUrl;
  if (camera.username && camera.password && /^(rtsp|rtmp):\/\//.test(url) && !/@/.test(url.split('://')[1] || '')) {
    url = url.replace(/^(rtsp|rtmp):\/\//, `$1://${camera.username}:${camera.password}@`);
  }
  return url;
}

// Discover ONVIF cameras on the local network (WS-Discovery).
router.post('/discover', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const timeout = Math.min(15000, Math.max(2000, Number(req.body?.timeout) || 5000));
    const devices = await OnvifService.discover(timeout);
    res.json({ devices });
  } catch (error) {
    logger.error('Error during camera discovery:', error);
    res.status(500).json({ error: 'Camera discovery failed' });
  }
});

// Get all cameras
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const cameras = await cameraRepo.find({ order: { name: 'ASC' } });

    // Add live status
    const camerasWithStatus = cameras.map(camera => ({
      ...camera,
      isStreaming: streamManager.isStreamActive(camera.id),
      isRecording: recordingEngine.isRecording(camera.id),
      motionMonitoring: motionDetector.isMonitoring(camera.id),
      viewers: streamManager.getSession(camera.id)?.viewers || 0,
    }));

    res.json(camerasWithStatus);
  } catch (error) {
    logger.error('Error fetching cameras:', error);
    res.status(500).json({ error: 'Failed to fetch cameras' });
  }
});

// Get camera by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    res.json({
      ...camera,
      isStreaming: streamManager.isStreamActive(camera.id),
      isRecording: recordingEngine.isRecording(camera.id),
      viewers: streamManager.getSession(camera.id)?.viewers || 0,
    });
  } catch (error) {
    logger.error('Error fetching camera:', error);
    res.status(500).json({ error: 'Failed to fetch camera' });
  }
});

// Create camera
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    logger.info('=== Creating new camera ===');
    logger.info('Camera data received:', JSON.stringify(req.body, null, 2));

    const cameraRepo = AppDataSource.getRepository(Camera);

    // Apply system-wide defaults for any fields the client didn't specify.
    const settingsRepo = AppDataSource.getRepository(SystemSettings);
    const settings = await settingsRepo.findOne({ where: {} });
    const body: any = { ...req.body };
    if (settings) {
      if (body.recordingMode === undefined && settings.defaultRecordingMode) {
        body.recordingMode = settings.defaultRecordingMode;
      }
      if (body.recordingFps === undefined && settings.defaultFrameRate) {
        body.recordingFps = settings.defaultFrameRate;
      }
      if (body.resolution === undefined && settings.defaultResolution) {
        body.resolution = settings.defaultResolution;
      }
      if (body.aiEnabled === undefined && settings.aiEnabled !== undefined) {
        body.aiEnabled = settings.aiEnabled;
      }
      if (body.aiSensitivity === undefined && settings.aiConfidenceThreshold) {
        body.aiSensitivity = Math.round(settings.aiConfidenceThreshold * 100);
      }
    }

    const camera = await cameraRepo.save(cameraRepo.create(body)) as unknown as Camera;

    logger.info(`✓ Camera saved to database: ${camera.name} (ID: ${camera.id})`);
    logger.info(`  - Stream URL: ${camera.streamUrl}`);
    logger.info(`  - Username: ${camera.username || 'none'}`);
    logger.info(`  - Enabled: ${camera.enabled}`);
    logger.info(`  - Recording Mode: ${camera.recordingMode}`);
    logger.info(`  - AI Enabled: ${camera.aiEnabled}`);

    // Start streaming and recording if enabled
    if (camera.enabled) {
      logger.info(`Starting services for camera ${camera.name}...`);

      logger.info('→ Starting stream...');
      await streamManager.startStream(camera);
      logger.info('✓ Stream start initiated');

      if (camera.recordingMode === 'continuous') {
        logger.info('→ Starting continuous recording...');
        await recordingEngine.startRecording(camera);
        logger.info('✓ Recording started');
      }

      if (camera.aiEnabled) {
        logger.info('→ Starting AI detection...');
        await aiDetectionCoordinator.startDetection(camera);
        logger.info('✓ AI detection started');
      }

      if (camera.motionEnabled) {
        logger.info('→ Starting motion detection...');
        motionDetector.start(camera);
        logger.info('✓ Motion detection started');
      }

      logger.info(`✓ All services started for camera ${camera.name}`);
    } else {
      logger.info(`Camera ${camera.name} is disabled, skipping service startup`);
    }

    logger.info('=== Camera creation complete ===');
    res.status(201).json(camera);
  } catch (error) {
    logger.error('✗ Error creating camera:', error);
    logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Failed to create camera' });
  }
});

// Update camera
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const wasEnabled = camera.enabled;

    Object.assign(camera, req.body);
    await cameraRepo.save(camera);

    // Restart services if needed
    if (camera.enabled && !wasEnabled) {
      await streamManager.startStream(camera);
      if (camera.recordingMode === 'continuous') {
        await recordingEngine.startRecording(camera);
      }
      if (camera.aiEnabled) {
        await aiDetectionCoordinator.startDetection(camera);
      }
      if (camera.motionEnabled) {
        motionDetector.start(camera);
      }
    } else if (!camera.enabled && wasEnabled) {
      await streamManager.stopStream(camera.id);
      await recordingEngine.stopRecording(camera.id);
      aiDetectionCoordinator.stopDetection(camera.id);
      motionDetector.stop(camera.id);
    } else if (camera.enabled) {
      // Already enabled: reconcile motion monitoring with the new setting.
      if (camera.motionEnabled && !motionDetector.isMonitoring(camera.id)) {
        motionDetector.start(camera);
      } else if (!camera.motionEnabled && motionDetector.isMonitoring(camera.id)) {
        motionDetector.stop(camera.id);
      }
    }

    res.json(camera);
  } catch (error) {
    logger.error('Error updating camera:', error);
    res.status(500).json({ error: 'Failed to update camera' });
  }
});

// Delete camera
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    // Stop all services
    await streamManager.stopStream(camera.id);
    await recordingEngine.stopRecording(camera.id);
    aiDetectionCoordinator.stopDetection(camera.id);
    motionDetector.stop(camera.id);

    await cameraRepo.remove(camera);

    res.json({ message: 'Camera deleted successfully' });
  } catch (error) {
    logger.error('Error deleting camera:', error);
    res.status(500).json({ error: 'Failed to delete camera' });
  }
});

// Test motion detection — runs a short analysis and reports observed scores.
router.post('/:id/motion/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const result = await motionDetector.sampleScore(camera);
    res.json({
      ...result,
      message: result.samples === 0
        ? 'No frames analyzed — check the camera stream and FFmpeg.'
        : result.wouldTrigger
          ? `Motion would trigger (peak ${result.maxScore.toFixed(1)} >= ${result.threshold.toFixed(1)}).`
          : `No motion above threshold (peak ${result.maxScore.toFixed(1)} < ${result.threshold.toFixed(1)}). Increase sensitivity if needed.`,
    });
  } catch (error) {
    logger.error('Error testing motion detection:', error);
    res.status(500).json({ error: 'Failed to test motion detection' });
  }
});

// Two-way audio (push-to-talk). Accepts a short audio clip and pushes it to
// the camera's RTSP audio backchannel via FFmpeg. Requires a camera that
// supports two-way audio; behaviour varies by vendor.
router.post('/:id/talk', authenticateToken, audioUpload.single('audio'), async (req: AuthRequest, res: Response) => {
  let tmpPath: string | undefined;
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }
    if (!camera.twoWayAudio) {
      res.status(400).json({ error: 'This camera is not configured for two-way audio' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No audio uploaded' });
      return;
    }

    tmpPath = path.join(os.tmpdir(), `talk_${camera.id}_${Date.now()}`);
    fs.writeFileSync(tmpPath, req.file.buffer);
    const target = withCredentials(camera);
    const cleanup = () => { if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* ignore */ } } };

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpPath!)
        // Transcode to G.711 µ-law, the codec most camera backchannels expect.
        .outputOptions(['-acodec pcm_mulaw', '-ar 8000', '-ac 1', '-f rtsp', '-rtsp_transport tcp'])
        .output(target)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    cleanup();
    res.json({ success: true, message: 'Audio sent to camera' });
  } catch (error) {
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* ignore */ } }
    logger.error('Two-way audio error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send audio. The camera may not support an RTSP audio backchannel.',
    });
  }
});

// Get camera snapshot
router.get('/:id/snapshot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const snapshotPath = await streamManager.captureSnapshot(camera);
    res.sendFile(snapshotPath);
  } catch (error) {
    logger.error('Error capturing snapshot:', error);
    res.status(500).json({ error: 'Failed to capture snapshot' });
  }
});

// Test camera connection
router.post('/:id/test-connection', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.id } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    logger.info(`Testing connection for camera: ${camera.name}`);
    const result = await streamManager.testConnection(camera);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Test camera connection with provided settings (before saving)
router.post('/test-connection', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    logger.info('Testing connection with provided camera settings');
    logger.info('Camera data:', JSON.stringify(req.body, null, 2));

    const cameraRepo = AppDataSource.getRepository(Camera);
    // Create temporary camera object (not saved to database)
    const tempCamera = cameraRepo.create(req.body as Partial<Camera>);

    const result = await streamManager.testConnection(tempCamera);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
