import { Router, Response } from 'express';
import { AppDataSource } from '../database';
import { Camera } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import streamManager from '../services/camera/StreamManager';
import recordingEngine from '../services/recording/RecordingEngine';
import aiDetectionCoordinator from '../services/ai/AIDetectionCoordinator';
import logger from '../utils/logger';

const router = Router();

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
    const camera = await cameraRepo.save(cameraRepo.create(req.body)) as unknown as Camera;

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
    } else if (!camera.enabled && wasEnabled) {
      await streamManager.stopStream(camera.id);
      await recordingEngine.stopRecording(camera.id);
      aiDetectionCoordinator.stopDetection(camera.id);
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

    await cameraRepo.remove(camera);

    res.json({ message: 'Camera deleted successfully' });
  } catch (error) {
    logger.error('Error deleting camera:', error);
    res.status(500).json({ error: 'Failed to delete camera' });
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

export default router;
