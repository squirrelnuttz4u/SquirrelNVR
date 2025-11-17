import { Router, Response } from 'express';
import { Between, Like } from 'typeorm';
import { AppDataSource } from '../database';
import { Recording, Camera } from '../database/entities';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import storageManager from '../services/storage/StorageManager';
import logger from '../utils/logger';

const router = Router();

// Search recordings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      cameraId,
      startDate,
      endDate,
      recordingType,
      hasAI,
      hasMotion,
      limit = 50,
      offset = 0,
    } = req.query;

    const where: any = {};

    if (cameraId) {
      where.cameraId = cameraId;
    }

    if (startDate && endDate) {
      where.startTime = Between(new Date(startDate as string), new Date(endDate as string));
    }

    if (recordingType) {
      where.recordingType = recordingType;
    }

    if (hasAI !== undefined) {
      where.hasAI = hasAI === 'true';
    }

    if (hasMotion !== undefined) {
      where.hasMotion = hasMotion === 'true';
    }

    const recordingRepo = AppDataSource.getRepository(Recording);
    const [recordings, total] = await recordingRepo.findAndCount({
      where,
      order: { startTime: 'DESC' },
      take: Number(limit),
      skip: Number(offset),
      relations: ['camera'],
    });

    res.json({
      recordings,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    logger.error('Error searching recordings:', error);
    res.status(500).json({ error: 'Failed to search recordings' });
  }
});

// Get recording by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recordingRepo = AppDataSource.getRepository(Recording);
    const recording = await recordingRepo.findOne({
      where: { id: req.params.id },
      relations: ['camera', 'detections'],
    });

    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    res.json(recording);
  } catch (error) {
    logger.error('Error fetching recording:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

// Stream recording video
router.get('/:id/video', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recordingRepo = AppDataSource.getRepository(Recording);
    const recording = await recordingRepo.findOne({ where: { id: req.params.id } });

    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    res.sendFile(recording.filePath);
  } catch (error) {
    logger.error('Error streaming recording:', error);
    res.status(500).json({ error: 'Failed to stream recording' });
  }
});

// Get recording thumbnail
router.get('/:id/thumbnail', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recordingRepo = AppDataSource.getRepository(Recording);
    const recording = await recordingRepo.findOne({ where: { id: req.params.id } });

    if (!recording || !recording.thumbnailPath) {
      res.status(404).json({ error: 'Thumbnail not found' });
      return;
    }

    res.sendFile(recording.thumbnailPath);
  } catch (error) {
    logger.error('Error fetching thumbnail:', error);
    res.status(500).json({ error: 'Failed to fetch thumbnail' });
  }
});

// Delete recording
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const recordingRepo = AppDataSource.getRepository(Recording);
    const recording = await recordingRepo.findOne({ where: { id: req.params.id } });

    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    await storageManager.deleteRecording(recording);

    res.json({ message: 'Recording deleted successfully' });
  } catch (error) {
    logger.error('Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// Get recordings timeline for a camera
router.get('/camera/:cameraId/timeline', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const recordingRepo = AppDataSource.getRepository(Recording);
    const recordings = await recordingRepo.find({
      where: {
        cameraId: req.params.cameraId,
        ...(startDate && endDate && {
          startTime: Between(new Date(startDate as string), new Date(endDate as string)),
        }),
      },
      order: { startTime: 'ASC' },
    });

    res.json(recordings);
  } catch (error) {
    logger.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

export default router;
