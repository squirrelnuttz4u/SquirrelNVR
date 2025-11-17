import { Router, Response } from 'express';
import { AppDataSource } from '../database';
import { Camera } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import ptzController from '../services/camera/PTZController';
import logger from '../utils/logger';

const router = Router();

// Initialize PTZ for a camera
router.post('/:cameraId/initialize', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.cameraId } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const initialized = await ptzController.initializeCamera(camera);

    if (initialized) {
      res.json({ success: true, message: 'PTZ initialized' });
    } else {
      res.status(400).json({ success: false, error: 'Camera does not support PTZ or initialization failed' });
    }
  } catch (error) {
    logger.error('PTZ initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize PTZ' });
  }
});

// Execute PTZ command
router.post('/:cameraId/command', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.cameraId } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const { action, speed, presetId } = req.body;

    if (!action) {
      res.status(400).json({ error: 'PTZ action required' });
      return;
    }

    const success = await ptzController.executeCommand(camera, {
      action,
      speed,
      presetId,
    });

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'PTZ command failed' });
    }
  } catch (error) {
    logger.error('PTZ command error:', error);
    res.status(500).json({ error: 'Failed to execute PTZ command' });
  }
});

// Get PTZ presets
router.get('/:cameraId/presets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.cameraId } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const presets = await ptzController.getPresets(camera);
    res.json({ presets });
  } catch (error) {
    logger.error('Get PTZ presets error:', error);
    res.status(500).json({ error: 'Failed to get PTZ presets' });
  }
});

// Set PTZ preset
router.post('/:cameraId/presets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.cameraId } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const { presetId, name } = req.body;

    if (presetId === undefined) {
      res.status(400).json({ error: 'Preset ID required' });
      return;
    }

    const success = await ptzController.setPreset(camera, presetId, name);

    if (success) {
      res.json({ success: true, message: 'PTZ preset saved' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to save preset' });
    }
  } catch (error) {
    logger.error('Set PTZ preset error:', error);
    res.status(500).json({ error: 'Failed to set PTZ preset' });
  }
});

// Get PTZ position
router.get('/:cameraId/position', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const camera = await cameraRepo.findOne({ where: { id: req.params.cameraId } });

    if (!camera) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    const position = await ptzController.getPosition(camera);

    if (position) {
      res.json({ position });
    } else {
      res.status(400).json({ error: 'Failed to get PTZ position' });
    }
  } catch (error) {
    logger.error('Get PTZ position error:', error);
    res.status(500).json({ error: 'Failed to get PTZ position' });
  }
});

export default router;
